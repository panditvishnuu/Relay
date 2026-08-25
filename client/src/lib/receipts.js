/**
 * Turns the deliveredTo / readBy arrays into the tick state a sender sees.
 *
 *   pending    clock      — optimistic, not yet acked
 *   sent       one tick   — the server has it, nobody else does
 *   delivered  two ticks  — on at least one recipient's device
 *   read       two blue   — every other member has actually read it
 *
 * "Read" requires *all* other members, so a group only turns blue once the
 * whole room has seen it. A direct chat has one other member, so it behaves
 * exactly as you'd expect.
 */
export function messageStatus(message, myId, memberIds) {
  if (message.status === 'pending' || message.status === 'failed') return message.status;
  if (String(message.senderId) !== String(myId)) return null; // no ticks on their messages

  const others = (memberIds ?? []).filter((id) => String(id) !== String(myId));
  if (!others.length) return 'sent';

  const readBy = new Set((message.readBy ?? []).map(String));
  const deliveredTo = new Set((message.deliveredTo ?? []).map(String));

  if (others.every((id) => readBy.has(String(id)))) return 'read';
  if (others.some((id) => deliveredTo.has(String(id)))) return 'delivered';
  return 'sent';
}

/** The ids of everyone in a conversation, direct or group. */
export function conversationMemberIds(conversation) {
  if (!conversation) return [];
  if (conversation.type === 'group') return (conversation.members ?? []).map((m) => String(m._id));
  return conversation.peer?._id ? [String(conversation.peer._id)] : [];
}
