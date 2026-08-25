import { toggleReaction } from '../../services/reaction.service.js';
import { Conversation } from '../../models/Conversation.js';
import { userRoom } from '../rooms.js';
import { throttled } from '../rateLimit.js';

export function registerReactionHandlers(io, socket) {
  const on = throttled(socket);
  on('message:react', async ({ messageId, emoji } = {}, ack) => {
    if (!messageId || !emoji) return ack?.({ ok: false, error: 'messageId and emoji are required' });

    try {
      const result = await toggleReaction({ messageId, userId: socket.userId, emoji });

      const conversation = await Conversation.findById(result.conversationId).select('members');
      for (const member of conversation?.members ?? []) {
        io.to(userRoom(member.user)).emit('message:reaction', result);
      }

      ack?.({ ok: true, ...result });
    } catch (err) {
      ack?.({ ok: false, error: err.message ?? 'Could not react' });
    }
  });
}
