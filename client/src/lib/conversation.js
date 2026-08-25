/** Display name + avatar for either a direct peer or a group. */
export function conversationIdentity(conversation) {
  if (!conversation) return { name: '', avatarUrl: null, peerId: null, isGroup: false };

  if (conversation.type === 'group') {
    return {
      name: conversation.name ?? 'Group',
      avatarUrl: conversation.avatarUrl,
      peerId: null,
      isGroup: true,
    };
  }

  return {
    name: conversation.peer?.name ?? 'Unknown',
    avatarUrl: conversation.peer?.avatarUrl,
    peerId: conversation.peer?._id,
    statusText: conversation.peer?.statusText,
    isGroup: false,
  };
}
