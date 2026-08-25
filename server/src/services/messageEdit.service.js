import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { ApiError } from '../lib/ApiError.js';
import { serializeMessage } from '../lib/serialize.js';

/**
 * Time windows, deliberately finite. An unlimited edit window lets someone
 * rewrite history after you've read it; an unlimited delete-for-everyone lets
 * them erase a conversation months later. Both match what people expect from
 * other messengers.
 */
export const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const DELETE_EVERYONE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const REPLY_FIELDS = 'sender type text attachment deletedAt';

/** Loads a message and asserts the user is in its conversation. */
async function loadForMember(messageId, userId) {
  const message = await Message.findById(messageId);
  if (!message) throw ApiError.notFound('Message not found');

  const isMember = await Conversation.exists({
    _id: message.conversation,
    'members.user': userId,
  });
  // same 404 as a genuinely missing message — membership isn't leaked
  if (!isMember) throw ApiError.notFound('Message not found');

  return message;
}

async function reserialize(message) {
  await message.populate([
    { path: 'sender', select: 'name avatarUrl' },
    { path: 'replyTo', select: REPLY_FIELDS, populate: { path: 'sender', select: 'name' } },
  ]);
  return serializeMessage(message);
}

/** Members to notify about a change. */
async function memberIdsOf(conversationId) {
  const conversation = await Conversation.findById(conversationId).select('members');
  return (conversation?.members ?? []).map((m) => String(m.user));
}

// ------------------------------------------------------------------- edit

export async function editMessage({ messageId, userId, text }) {
  const message = await loadForMember(messageId, userId);

  if (String(message.sender) !== String(userId)) {
    throw ApiError.forbidden('You can only edit your own messages');
  }
  if (message.deletedAt) throw ApiError.badRequest('That message was deleted');
  if (message.type !== 'text') throw ApiError.badRequest('Only text messages can be edited');

  const body = (text ?? '').trim();
  if (!body) throw ApiError.badRequest('Message cannot be empty');
  if (body.length > 4000) throw ApiError.badRequest('Message is too long');

  if (Date.now() - message.createdAt.getTime() > EDIT_WINDOW_MS) {
    throw ApiError.badRequest('Messages can only be edited within 15 minutes of sending');
  }

  if (body === message.text) return { message: await reserialize(message), memberIds: [] };

  message.text = body;
  message.editedAt = new Date();
  await message.save();

  // keep the sidebar preview honest if this was the latest message
  await Conversation.updateOne(
    { _id: message.conversation, 'lastMessage.at': message.createdAt },
    { $set: { 'lastMessage.text': body } }
  );

  return {
    message: await reserialize(message),
    memberIds: await memberIdsOf(message.conversation),
    conversationId: String(message.conversation),
  };
}

// ----------------------------------------------------------------- delete

/** Per-user hide. Nobody else is affected and no event is broadcast. */
export async function deleteForMe({ messageId, userId }) {
  const message = await loadForMember(messageId, userId);

  await Message.updateOne({ _id: message._id }, { $addToSet: { deletedFor: userId } });

  return { messageId: String(message._id), conversationId: String(message.conversation) };
}

/**
 * Delete for everyone. The row survives so the thread keeps its shape and any
 * replies pointing at it still resolve — the content is stripped instead.
 */
export async function deleteForEveryone({ messageId, userId }) {
  const message = await loadForMember(messageId, userId);

  if (String(message.sender) !== String(userId)) {
    throw ApiError.forbidden('You can only delete your own messages for everyone');
  }
  if (message.deletedAt) return { alreadyDeleted: true, messageId: String(message._id) };

  if (Date.now() - message.createdAt.getTime() > DELETE_EVERYONE_WINDOW_MS) {
    throw ApiError.badRequest(
      'Messages can only be deleted for everyone within an hour — you can still delete it for yourself'
    );
  }

  message.deletedAt = new Date();
  message.text = undefined;
  message.attachment = undefined;
  message.reactions = [];
  await message.save();

  await Conversation.updateOne(
    { _id: message.conversation, 'lastMessage.at': message.createdAt },
    { $set: { 'lastMessage.text': 'This message was deleted' } }
  );

  return {
    messageId: String(message._id),
    conversationId: String(message.conversation),
    message: await reserialize(message),
    memberIds: await memberIdsOf(message.conversation),
  };
}

// ---------------------------------------------------------------- forward

/**
 * Forwarding copies content rather than referencing the original, so the
 * recipient keeps it even if the sender later deletes theirs — and never gains
 * access to the source conversation.
 */
export async function buildForwardPayload({ messageId, userId }) {
  const message = await loadForMember(messageId, userId);
  if (message.deletedAt) throw ApiError.badRequest('That message was deleted');

  return {
    text: message.text,
    type: message.type,
    attachment: message.attachment?.url ? message.attachment.toObject?.() ?? message.attachment : undefined,
  };
}

/** Validates that a reply target exists in the same conversation. */
export async function assertReplyTarget(replyToId, conversationId) {
  if (!replyToId) return null;

  const target = await Message.findById(replyToId).select('conversation');
  if (!target || String(target.conversation) !== String(conversationId)) {
    throw ApiError.badRequest('You can only reply to messages in this conversation');
  }
  return replyToId;
}
