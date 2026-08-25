import { useEffect } from 'react';
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket';
import { useChatStore } from '@/store/chat';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';

/**
 * Owns the socket lifecycle for the authenticated app: connect on mount,
 * subscribe to server events, tear down on logout. Mounted once, in ChatPage.
 *
 * Handlers read the *current* store state via getState() rather than closing
 * over props, so the subscription never needs to be torn down and re-attached
 * when the active conversation changes.
 */
export function useRealtime() {
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    if (status !== 'authenticated') return;

    const socket = connectSocket();
    const chat = () => useChatStore.getState();

    const onPresenceInit = ({ userIds }) => chat().setPresenceSnapshot(userIds);
    const onPresenceUpdate = ({ userId, isOnline }) => chat().setPresence(userId, isOnline);

    const onMessage = (payload) =>
      chat().receiveMessage(payload, {
        activeConversationId: useUIStore.getState().activeConversationId,
        myId: useAuthStore.getState().user?._id,
      });

    const onDelivered = (payload) => chat().applyReceipt(payload, 'deliveredTo');
    const onRead = (payload) => chat().applyReceipt(payload, 'readBy');
    const onReaction = (payload) => chat().applyReaction(payload);
    const onUpdated = ({ conversationId, message }) => chat().replaceMessageById(conversationId, message);
    const onRemoved = ({ conversationId, messageId }) => chat().removeMessage(conversationId, messageId);

    const onUserUpdated = ({ user, self }) => {
      chat().applyUserUpdate(user);
      if (self) useAuthStore.getState().setUser(user);
    };
    const onCleared = ({ conversationId }) => chat().clearConversationLocal(conversationId);
    const onHidden = ({ conversationId }) => chat().dropConversation(conversationId);

    const onConversationUpdated = (payload) =>
      chat().applyConversationUpdate(payload, { myId: useAuthStore.getState().user?._id });

    const onTyping = (payload) => {
      // resolve the display name from whichever conversation it belongs to
      const conversation = chat().conversations.find((c) => c._id === payload.conversationId);
      const name =
        conversation?.type === 'group'
          ? conversation.members?.find((m) => String(m._id) === String(payload.userId))?.name
          : conversation?.peer?.name;
      chat().setTyping(payload, name);
    };

    // a dropped connection can miss events, so resync the list on every connect
    const onConnect = () => chat().fetchConversations().catch(() => {});

    socket.on('connect', onConnect);
    socket.on('presence:init', onPresenceInit);
    socket.on('presence:update', onPresenceUpdate);
    socket.on('message:new', onMessage);
    socket.on('receipt:delivered', onDelivered);
    socket.on('receipt:read', onRead);
    socket.on('typing:update', onTyping);
    socket.on('conversation:updated', onConversationUpdated);
    socket.on('message:reaction', onReaction);
    socket.on('message:updated', onUpdated);
    socket.on('message:removed', onRemoved);
    socket.on('user:updated', onUserUpdated);
    socket.on('conversation:cleared', onCleared);
    socket.on('conversation:hidden', onHidden);

    return () => {
      socket.off('connect', onConnect);
      socket.off('presence:init', onPresenceInit);
      socket.off('presence:update', onPresenceUpdate);
      socket.off('message:new', onMessage);
      socket.off('receipt:delivered', onDelivered);
      socket.off('receipt:read', onRead);
      socket.off('typing:update', onTyping);
      socket.off('conversation:updated', onConversationUpdated);
      socket.off('message:reaction', onReaction);
      socket.off('message:updated', onUpdated);
      socket.off('message:removed', onRemoved);
      socket.off('user:updated', onUserUpdated);
      socket.off('conversation:cleared', onCleared);
      socket.off('conversation:hidden', onHidden);
    };
  }, [status]);

  // full teardown when the session ends
  useEffect(() => {
    if (status === 'anonymous' && getSocket()) {
      disconnectSocket();
      useChatStore.getState().reset();
    }
  }, [status]);
}
