import { create } from 'zustand';
import { api } from '@/lib/api';
import { emitWithAck, getSocket } from '@/lib/socket';

/**
 * Single source of truth for chat data. REST fills it, socket events patch it.
 * Deliberately not react-query: a live socket and a cache that refetches on its
 * own schedule end up fighting over the same rows.
 */
export const useChatStore = create((set, get) => ({
  conversations: [],
  conversationsLoaded: false,

  messagesByConversation: {}, // id -> [message]
  pagination: {}, // id -> { hasMore, nextCursor, loading }

  onlineUserIds: new Set(),
  typingByConversation: {}, // id -> { userId: name }

  // ---------------------------------------------------------------- loading

  async fetchConversations() {
    const { data } = await api.get('/conversations');
    set({ conversations: data.conversations, conversationsLoaded: true });
    return data.conversations;
  },

  async fetchMessages(conversationId) {
    if (get().messagesByConversation[conversationId]) return; // already have a page

    setPagination(set, conversationId, { loading: true });
    try {
      const { data } = await api.get(`/conversations/${conversationId}/messages`);
      set((s) => ({
        messagesByConversation: { ...s.messagesByConversation, [conversationId]: data.messages },
      }));
      setPagination(set, conversationId, {
        loading: false,
        hasMore: data.hasMore,
        nextCursor: data.nextCursor,
      });
    } catch (err) {
      setPagination(set, conversationId, { loading: false });
      throw err;
    }
  },

  /**
   * Older page, prepended. Returns how many arrived so the caller can restore
   * the scroll position — otherwise the viewport jumps as content grows above.
   */
  async loadOlderMessages(conversationId) {
    const page = get().pagination[conversationId];
    if (!page?.hasMore || page.loading) return 0;

    setPagination(set, conversationId, { loading: true });
    try {
      const { data } = await api.get(`/conversations/${conversationId}/messages`, {
        params: { before: page.nextCursor },
      });

      set((s) => ({
        messagesByConversation: {
          ...s.messagesByConversation,
          [conversationId]: [...data.messages, ...(s.messagesByConversation[conversationId] ?? [])],
        },
      }));
      setPagination(set, conversationId, {
        loading: false,
        hasMore: data.hasMore,
        nextCursor: data.nextCursor,
      });
      return data.messages.length;
    } catch (err) {
      setPagination(set, conversationId, { loading: false });
      throw err;
    }
  },

  // ---------------------------------------------------------------- writing

  /** Opens (or reuses) a direct chat and makes sure it's in the sidebar. */
  async openDirect(userId) {
    const { data } = await api.post('/conversations/direct', { userId });
    const conversation = data.conversation;

    set((s) =>
      s.conversations.some((c) => c._id === conversation._id)
        ? {}
        : { conversations: [conversation, ...s.conversations] }
    );
    return conversation;
  },

  /**
   * Optimistic send: the bubble appears immediately with a `pending` clock,
   * then the server ack swaps in the real document. A failure marks it failed
   * rather than silently dropping it.
   */
  async sendMessage(conversationId, { text = '', attachment, type = 'text', replyTo } = {}, senderId) {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic = {
      _id: tempId,
      // survives the swap below, so the bubble doesn't re-mount and re-animate
      _localKey: tempId,
      conversationId,
      senderId,
      type: attachment ? type : 'text',
      text,
      attachment,
      createdAt: new Date().toISOString(),
      status: 'pending',
      deliveredTo: [senderId],
      readBy: [senderId],
      reactions: [],
      // the local quote so the optimistic bubble already shows what it answers
      replyTo: replyTo
        ? {
            _id: replyTo._id,
            senderId: replyTo.senderId,
            senderName: replyTo.senderName,
            type: replyTo.type,
            text: replyTo.text,
            attachmentName: replyTo.attachment?.name,
          }
        : undefined,
    };

    appendMessage(set, get, conversationId, optimistic);

    try {
      const { message } = await emitWithAck('message:send', {
        conversationId,
        text,
        tempId,
        ...(attachment && { attachment, type }),
        ...(replyTo && { replyTo: replyTo._id }),
      });
      // message:new usually beats the ack; replaceMessage handles either order
      replaceMessage(set, conversationId, tempId, { ...message, _localKey: tempId });
      return message;
    } catch (err) {
      replaceMessage(set, conversationId, tempId, { ...optimistic, status: 'failed' });
      throw err;
    }
  },

  // ----------------------------------------------------------------- groups

  async createGroup({ name, memberIds }) {
    const { data } = await api.post('/conversations/group', { name, memberIds });
    upsertConversation(set, data.conversation);
    return data.conversation;
  },

  async renameGroup(conversationId, name) {
    const { data } = await api.patch(`/conversations/${conversationId}`, { name });
    upsertConversation(set, data.conversation);
    return data.conversation;
  },

  async addGroupMembers(conversationId, memberIds) {
    const { data } = await api.post(`/conversations/${conversationId}/members`, { memberIds });
    upsertConversation(set, data.conversation);
    return data.conversation;
  },

  /** Removing yourself is leaving; the conversation drops out of the sidebar. */
  async removeGroupMember(conversationId, targetId) {
    const { data } = await api.delete(`/conversations/${conversationId}/members/${targetId}`);
    if (data.left) get().dropConversation(conversationId);
    else upsertConversation(set, data.conversation);
    return data;
  },

  dropConversation(conversationId) {
    set((s) => {
      const messages = { ...s.messagesByConversation };
      delete messages[conversationId];
      return {
        conversations: s.conversations.filter((c) => c._id !== conversationId),
        messagesByConversation: messages,
      };
    });
  },

  /**
   * conversation:updated — a group was created, renamed, or had members change.
   * Carries the system message so the thread updates in the same tick.
   */
  applyConversationUpdate({ conversation, systemMessage, removedId }, { myId } = {}) {
    // we were the one removed: drop it rather than showing a group we've left
    if (removedId && String(removedId) === String(myId)) {
      get().dropConversation(conversation._id);
      return;
    }

    upsertConversation(set, conversation, { preserveUnread: true });

    if (systemMessage) {
      set((s) => {
        const list = s.messagesByConversation[conversation._id];
        if (!list || list.some((m) => m._id === systemMessage._id)) return {};
        return {
          messagesByConversation: {
            ...s.messagesByConversation,
            [conversation._id]: [...list, systemMessage],
          },
        };
      });
    }
  },

  /** Tells the server we've read up to the newest message and clears the badge. */
  markConversationRead(conversationId) {
    const socket = getSocket();
    if (!socket?.connected) return;

    const messages = get().messagesByConversation[conversationId];
    const last = messages?.at(-1);
    if (!last || String(last._id).startsWith('temp-')) return;

    const conversation = get().conversations.find((c) => c._id === conversationId);
    if (!conversation?.unreadCount) return; // nothing to clear

    // optimistic: the badge shouldn't linger while the round-trip happens
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c._id === conversationId ? { ...c, unreadCount: 0 } : c
      ),
    }));

    socket.emit('conversation:read', { conversationId, lastMessageId: last._id });
  },

  // ------------------------------------------------------- socket reducers

  /** message:new — from anyone, including our own other tabs. */
  receiveMessage({ message, conversation }, { activeConversationId, myId } = {}) {
    const convId = String(message.conversationId);
    const existing = get().messagesByConversation[convId];
    const fromMe = String(message.senderId) === String(myId);

    set((s) => {
      const next = { ...s.messagesByConversation };

      if (existing) {
        // drop the optimistic twin if the ack hasn't landed yet, but inherit its
        // animation key so the bubble settles instead of popping in again
        const twin = existing.find(
          (m) => m.status === 'pending' && m.text === message.text && String(m.senderId) === String(message.senderId)
        );
        const withoutTemp = existing.filter((m) => m !== twin);

        next[convId] = withoutTemp.some((m) => m._id === message._id)
          ? withoutTemp
          : [...withoutTemp, { ...message, _localKey: twin?._localKey }];
      }

      /**
       * The server sends unreadCount: null on live events (see the socket
       * handler). We derive it: anything from someone else, in a thread that
       * isn't currently open, bumps the badge.
       */
      const previous = s.conversations.find((c) => c._id === conversation._id);
      const shouldCount = !fromMe && String(convId) !== String(activeConversationId);
      const unreadCount = shouldCount ? (previous?.unreadCount ?? 0) + 1 : (fromMe ? 0 : previous?.unreadCount ?? 0);

      // bubble the conversation to the top with its new preview
      const others = s.conversations.filter((c) => c._id !== conversation._id);
      return {
        messagesByConversation: next,
        conversations: [{ ...conversation, unreadCount }, ...others],
      };
    });
  },

  /** receipt:delivered / receipt:read — patch the tick arrays in place. */
  applyReceipt({ conversationId, userId, messageIds }, field) {
    if (!messageIds?.length) return;
    const ids = new Set(messageIds.map(String));

    set((s) => {
      const list = s.messagesByConversation[conversationId];
      if (!list) return {};

      return {
        messagesByConversation: {
          ...s.messagesByConversation,
          [conversationId]: list.map((m) =>
            ids.has(String(m._id)) && !(m[field] ?? []).map(String).includes(String(userId))
              ? { ...m, [field]: [...(m[field] ?? []), userId] }
              : m
          ),
        },
      };
    });
  },

  /** Optimistic reaction toggle; the server event is authoritative. */
  async toggleReaction(conversationId, messageId, emoji, myId) {
    const list = get().messagesByConversation[conversationId];
    const current = list?.find((m) => m._id === messageId)?.reactions ?? [];

    const mine = current.find((r) => String(r.user) === String(myId));
    const optimistic =
      mine?.emoji === emoji
        ? current.filter((r) => String(r.user) !== String(myId))
        : [...current.filter((r) => String(r.user) !== String(myId)), { user: myId, emoji }];

    get().applyReaction({ conversationId, messageId, reactions: optimistic });

    try {
      await emitWithAck('message:react', { messageId, emoji });
    } catch {
      // put it back the way it was
      get().applyReaction({ conversationId, messageId, reactions: current });
    }
  },

  applyReaction({ conversationId, messageId, reactions }) {
    set((s) => {
      const list = s.messagesByConversation[conversationId];
      if (!list) return {};
      return {
        messagesByConversation: {
          ...s.messagesByConversation,
          [conversationId]: list.map((m) => (String(m._id) === String(messageId) ? { ...m, reactions } : m)),
        },
      };
    });
  },

  // ------------------------------------------------- message maintenance

  async editMessage(conversationId, messageId, text) {
    const { message } = await emitWithAck('message:edit', { messageId, text });
    get().replaceMessageById(conversationId, message);
    return message;
  },

  /** scope: 'me' hides it locally, 'everyone' turns it into a tombstone. */
  async deleteMessage(conversationId, messageId, scope) {
    await emitWithAck('message:delete', { messageId, scope });
    if (scope === 'me') get().removeMessage(conversationId, messageId);
  },

  async forwardMessage(messageId, conversationIds) {
    const { delivered } = await emitWithAck('message:forward', { messageId, conversationIds });
    return delivered;
  },

  /** message:updated — an edit or a delete-for-everyone landed. */
  replaceMessageById(conversationId, message) {
    set((s) => {
      const list = s.messagesByConversation[conversationId];
      if (!list) return {};
      return {
        messagesByConversation: {
          ...s.messagesByConversation,
          [conversationId]: list.map((m) =>
            String(m._id) === String(message._id) ? { ...m, ...message } : m
          ),
        },
      };
    });
  },

  /** message:removed — a delete-for-me on one of our own devices. */
  removeMessage(conversationId, messageId) {
    set((s) => {
      const list = s.messagesByConversation[conversationId];
      if (!list) return {};
      return {
        messagesByConversation: {
          ...s.messagesByConversation,
          [conversationId]: list.filter((m) => String(m._id) !== String(messageId)),
        },
      };
    });
  },

  // --------------------------------------------- profile & housekeeping

  /**
   * user:updated — someone changed their name, avatar or status. Patch every
   * place their identity is cached: direct peers and group member lists.
   */
  applyUserUpdate(user) {
    set((s) => ({
      conversations: s.conversations.map((c) => {
        if (c.type === 'group') {
          if (!c.members?.some((m) => String(m._id) === String(user._id))) return c;
          return {
            ...c,
            members: c.members.map((m) =>
              String(m._id) === String(user._id) ? { ...m, ...user } : m
            ),
          };
        }
        return String(c.peer?._id) === String(user._id) ? { ...c, peer: { ...c.peer, ...user } } : c;
      }),
    }));
  },

  async clearConversation(conversationId) {
    await api.delete(`/conversations/${conversationId}/messages`);
    get().clearConversationLocal(conversationId);
  },

  clearConversationLocal(conversationId) {
    set((s) => ({
      messagesByConversation: { ...s.messagesByConversation, [conversationId]: [] },
      pagination: { ...s.pagination, [conversationId]: { hasMore: false, loading: false } },
      conversations: s.conversations.map((c) =>
        c._id === conversationId ? { ...c, lastMessage: null, unreadCount: 0 } : c
      ),
    }));
  },

  async deleteConversation(conversationId) {
    await api.delete(`/conversations/${conversationId}`);
    get().dropConversation(conversationId);
  },

  async setBlocked(userId, blocked) {
    await (blocked
      ? api.post(`/users/${userId}/block`)
      : api.delete(`/users/${userId}/block`));
    return blocked;
  },

  setTyping({ conversationId, userId, isTyping }, name) {
    set((s) => {
      const current = { ...(s.typingByConversation[conversationId] ?? {}) };
      if (isTyping) current[userId] = name ?? 'Someone';
      else delete current[userId];

      return {
        typingByConversation: { ...s.typingByConversation, [conversationId]: current },
      };
    });
  },

  setPresenceSnapshot(userIds) {
    set({ onlineUserIds: new Set(userIds.map(String)) });
  },

  setPresence(userId, isOnline) {
    set((s) => {
      const next = new Set(s.onlineUserIds);
      isOnline ? next.add(String(userId)) : next.delete(String(userId));
      return { onlineUserIds: next };
    });
  },

  reset() {
    set({
      conversations: [],
      conversationsLoaded: false,
      messagesByConversation: {},
      pagination: {},
      onlineUserIds: new Set(),
      typingByConversation: {},
    });
  },
}));

// ------------------------------------------------------------------ helpers

/**
 * Inserts or replaces a conversation, keeping it at the top. The server sends
 * unreadCount: null on live events, so `preserveUnread` keeps whatever the
 * client already had rather than blanking the badge.
 */
function upsertConversation(set, conversation, { preserveUnread = false } = {}) {
  set((s) => {
    const previous = s.conversations.find((c) => c._id === conversation._id);
    const unreadCount =
      conversation.unreadCount ?? (preserveUnread ? (previous?.unreadCount ?? 0) : 0);

    return {
      conversations: [
        { ...previous, ...conversation, unreadCount },
        ...s.conversations.filter((c) => c._id !== conversation._id),
      ],
    };
  });
}

function setPagination(set, conversationId, patch) {
  set((s) => ({
    pagination: { ...s.pagination, [conversationId]: { ...s.pagination[conversationId], ...patch } },
  }));
}

function appendMessage(set, get, conversationId, message) {
  if (!get().messagesByConversation[conversationId]) return;
  set((s) => ({
    messagesByConversation: {
      ...s.messagesByConversation,
      [conversationId]: [...s.messagesByConversation[conversationId], message],
    },
  }));
}

function replaceMessage(set, conversationId, targetId, replacement) {
  set((s) => {
    const list = s.messagesByConversation[conversationId];
    if (!list) return {};

    const index = list.findIndex((m) => m._id === targetId);
    if (index === -1) return {}; // the socket event already reconciled it

    // the real document arrived first — just drop the placeholder
    if (list.some((m) => m._id === replacement._id && m._id !== targetId)) {
      return {
        messagesByConversation: {
          ...s.messagesByConversation,
          [conversationId]: list.filter((m) => m._id !== targetId),
        },
      };
    }

    const next = [...list];
    next[index] = replacement;
    return { messagesByConversation: { ...s.messagesByConversation, [conversationId]: next } };
  });
}
