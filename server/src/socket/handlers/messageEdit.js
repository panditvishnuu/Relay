import {
  buildForwardPayload,
  deleteForEveryone,
  deleteForMe,
  editMessage,
} from '../../services/messageEdit.service.js';
import { createMessage } from '../../services/message.service.js';
import { serializeConversation } from '../../lib/serialize.js';
import { Conversation } from '../../models/Conversation.js';
import { userRoom } from '../rooms.js';
import { throttled } from '../rateLimit.js';

const fail = (err) => ({ ok: false, error: err.message ?? 'Something went wrong' });

export function registerMessageEditHandlers(io, socket) {
  const on = throttled(socket);
  /** message:edit — own text messages, inside the edit window. */
  on('message:edit', async ({ messageId, text } = {}, ack) => {
    try {
      const result = await editMessage({ messageId, userId: socket.userId, text });

      for (const memberId of result.memberIds) {
        io.to(userRoom(memberId)).emit('message:updated', {
          conversationId: result.conversationId,
          message: result.message,
        });
      }
      ack?.({ ok: true, message: result.message });
    } catch (err) {
      ack?.(fail(err));
    }
  });

  /**
   * message:delete — scope 'me' hides it for this user only and needs no
   * broadcast; scope 'everyone' turns it into a tombstone for the whole room.
   */
  on('message:delete', async ({ messageId, scope = 'me' } = {}, ack) => {
    try {
      if (scope === 'everyone') {
        const result = await deleteForEveryone({ messageId, userId: socket.userId });

        for (const memberId of result.memberIds ?? []) {
          io.to(userRoom(memberId)).emit('message:updated', {
            conversationId: result.conversationId,
            message: result.message,
          });
        }
        return ack?.({ ok: true, scope, messageId: result.messageId });
      }

      const result = await deleteForMe({ messageId, userId: socket.userId });

      // only this user's own devices need to know
      io.to(userRoom(socket.userId)).emit('message:removed', {
        conversationId: result.conversationId,
        messageId: result.messageId,
      });
      ack?.({ ok: true, scope, messageId: result.messageId });
    } catch (err) {
      ack?.(fail(err));
    }
  });

  /**
   * message:forward — copies the content into another conversation the sender
   * is a member of. createMessage does the membership check on the target, so
   * you can't forward into a room you're not in.
   */
  on('message:forward', async ({ messageId, conversationIds = [] } = {}, ack) => {
    try {
      const payload = await buildForwardPayload({ messageId, userId: socket.userId });
      const delivered = [];

      for (const conversationId of conversationIds.slice(0, 10)) {
        const { message, memberIds, conversation } = await createMessage({
          conversationId,
          senderId: socket.userId,
          ...payload,
        });

        const populated = await Conversation.findById(conversation._id).populate(
          'members.user',
          'name avatarUrl statusText isOnline lastSeen'
        );

        for (const memberId of memberIds) {
          io.to(userRoom(memberId)).emit('message:new', {
            message,
            conversation: serializeConversation(populated, memberId, null),
          });
        }
        delivered.push(String(conversationId));
      }

      ack?.({ ok: true, delivered });
    } catch (err) {
      ack?.(fail(err));
    }
  });
}
