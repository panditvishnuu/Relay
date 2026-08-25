import { createMessage } from '../../services/message.service.js';
import { serializeConversation } from '../../lib/serialize.js';
import { Conversation } from '../../models/Conversation.js';
import { userRoom } from '../rooms.js';
import { throttled } from '../rateLimit.js';

/** Socket.io acks want `(error, result)`-ish objects; keep one shape. */
const fail = (message) => ({ ok: false, error: message });

export function registerMessageHandlers(io, socket) {
  const on = throttled(socket);
  /**
   * message:send — persist, then fan out to every member's room.
   *
   * The ack resolves the sender's optimistic bubble: it carries `tempId` back
   * so the client can swap its placeholder for the real document, and the
   * sender is inside the fan-out too, so their other tabs stay in sync.
   */
  on('message:send', async (payload = {}, ack) => {
    const { conversationId, text, tempId, type, attachment, replyTo } = payload;

    try {
      const { message, memberIds, conversation } = await createMessage({
        conversationId,
        senderId: socket.userId,
        text,
        type,
        attachment,
        replyTo,
      });

      // the sidebar needs the updated lastMessage; re-serialize per viewer
      const populated = await Conversation.findById(conversation._id).populate(
        'members.user',
        'name avatarUrl statusText isOnline lastSeen'
      );

      for (const memberId of memberIds) {
        io.to(userRoom(memberId)).emit('message:new', {
          message,
          /**
           * unreadCount is null on purpose: recomputing it per recipient would
           * mean an aggregation on every keystroke-sized message. The client
           * increments its own counter instead, and the REST list endpoint is
           * the authority whenever it resyncs.
           */
          conversation: serializeConversation(populated, memberId, null),
        });
      }

      ack?.({ ok: true, tempId, message });
    } catch (err) {
      ack?.(fail(err.message ?? 'Could not send message'));
    }
  });
}
