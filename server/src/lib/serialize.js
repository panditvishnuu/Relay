/**
 * One place that decides the JSON shape the client sees. Both REST responses
 * and socket payloads go through here, so a message looks identical whether it
 * arrived from a fetch or from a live event.
 */

export function serializeUser(user) {
  if (!user) return null;
  return {
    _id: user._id,
    name: user.name,
    avatarUrl: user.avatarUrl,
    statusText: user.statusText,
    isOnline: user.isOnline,
    lastSeen: user.lastSeen,
  };
}

export function serializeMessage(message) {
  const senderId = message.sender?._id ?? message.sender;

  // deleted-for-everyone keeps its slot in the thread but carries no content
  if (message.deletedAt) {
    return {
      _id: message._id,
      conversationId: message.conversation,
      senderId,
      type: 'deleted',
      text: null,
      reactions: [],
      createdAt: message.createdAt,
      deletedAt: message.deletedAt,
      deliveredTo: [],
      readBy: [],
    };
  }

  return {
    _id: message._id,
    conversationId: message.conversation,
    senderId,
    sender: message.sender?.name ? serializeUser(message.sender) : undefined,
    type: message.type,
    text: message.text,
    attachment: message.attachment?.url ? message.attachment : undefined,
    reactions: (message.reactions ?? []).map((r) => ({ user: String(r.user), emoji: r.emoji })),
    createdAt: message.createdAt,
    editedAt: message.editedAt ?? undefined,
    // a compact quote of whatever this replies to — enough to render the
    // preview without a second round trip
    replyTo: message.replyTo?._id
      ? {
          _id: message.replyTo._id,
          senderId: message.replyTo.sender?._id ?? message.replyTo.sender,
          senderName: message.replyTo.sender?.name,
          type: message.replyTo.deletedAt ? 'deleted' : message.replyTo.type,
          text: message.replyTo.deletedAt ? null : message.replyTo.text,
          attachmentName: message.replyTo.attachment?.name,
        }
      : undefined,
    // chunk 4 turns these arrays into per-viewer tick state
    deliveredTo: message.deliveredTo ?? [],
    readBy: message.readBy ?? [],
  };
}

/**
 * Conversations are viewer-relative: a direct chat's title is the *other*
 * person, so the same document serializes differently per user.
 */
export function serializeConversation(conversation, viewerId, unreadCount = 0) {
  const me = String(viewerId);
  const members = conversation.members ?? [];

  const base = {
    _id: conversation._id,
    type: conversation.type,
    lastMessage: conversation.lastMessage?.at
      ? {
          text: conversation.lastMessage.text,
          type: conversation.lastMessage.type,
          senderId: conversation.lastMessage.sender,
          at: conversation.lastMessage.at,
        }
      : null,
    unreadCount,
    updatedAt: conversation.updatedAt,
  };

  if (conversation.type === 'group') {
    return {
      ...base,
      name: conversation.name,
      avatarUrl: conversation.avatarUrl,
      createdBy: conversation.createdBy,
      members: members.map((m) => ({ ...serializeUser(m.user), role: m.role })),
    };
  }

  const peerEntry = members.find((m) => String(m.user?._id ?? m.user) !== me) ?? members[0];
  return { ...base, peer: serializeUser(peerEntry?.user) };
}
