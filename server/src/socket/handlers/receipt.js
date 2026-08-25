import { markRead } from '../../services/receipt.service.js';
import { userRoom } from '../rooms.js';

export function registerReceiptHandlers(io, socket) {
  /**
   * conversation:read — the client had the thread open and scrolled to the
   * bottom. Fans the receipt out to every member so senders can flip their
   * ticks, and back to the reader's own room so their other tabs clear the
   * unread badge too.
   */
  socket.on('conversation:read', async ({ conversationId, lastMessageId } = {}, ack) => {
    if (!conversationId) return ack?.({ ok: false, error: 'conversationId is required' });

    try {
      const receipt = await markRead({ conversationId, userId: socket.userId, lastMessageId });

      for (const memberId of receipt.memberIds) {
        io.to(userRoom(memberId)).emit('receipt:read', {
          conversationId: receipt.conversationId,
          userId: receipt.userId,
          messageIds: receipt.messageIds,
          readUpTo: receipt.readUpTo,
        });
      }

      ack?.({ ok: true, count: receipt.messageIds.length });
    } catch (err) {
      ack?.({ ok: false, error: err.message ?? 'Could not mark as read' });
    }
  });
}
