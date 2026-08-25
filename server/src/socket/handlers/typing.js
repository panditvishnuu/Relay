import { Conversation } from '../../models/Conversation.js';
import { userRoom } from '../rooms.js';
import { throttled } from '../rateLimit.js';

/**
 * Typing is ephemeral — never persisted, never queued. If a client drops mid
 * "…is typing", the server-side expiry below clears it rather than leaving a
 * ghost indicator on everyone else's screen.
 */
const TYPING_TTL_MS = 6000;

export function registerTypingHandlers(io, socket) {
  const on = throttled(socket);
  // conversationId -> timeout, so a disconnect can clear every active one
  const timers = new Map();

  async function broadcast(conversationId, isTyping) {
    const conversation = await Conversation.findOne({
      _id: conversationId,
      'members.user': socket.userId,
    }).select('members');
    if (!conversation) return;

    for (const member of conversation.members) {
      // no point telling you that you are typing
      if (String(member.user) === String(socket.userId)) continue;
      io.to(userRoom(member.user)).emit('typing:update', {
        conversationId: String(conversationId),
        userId: String(socket.userId),
        isTyping,
      });
    }
  }

  function clear(conversationId, notify) {
    const timer = timers.get(conversationId);
    if (timer) clearTimeout(timer);
    timers.delete(conversationId);
    if (notify) broadcast(conversationId, false).catch(() => {});
  }

  on('typing:start', ({ conversationId } = {}) => {
    if (!conversationId) return;

    // only announce on the leading edge; keystrokes just extend the timer
    if (!timers.has(conversationId)) broadcast(conversationId, true).catch(() => {});
    else clearTimeout(timers.get(conversationId));

    timers.set(
      conversationId,
      setTimeout(() => clear(conversationId, true), TYPING_TTL_MS)
    );
  });

  socket.on('typing:stop', ({ conversationId } = {}) => {
    if (conversationId && timers.has(conversationId)) clear(conversationId, true);
  });

  socket.on('disconnect', () => {
    for (const conversationId of [...timers.keys()]) clear(conversationId, true);
  });
}
