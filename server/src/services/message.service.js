import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { ApiError } from '../lib/ApiError.js';
import { serializeMessage } from '../lib/serialize.js';
import { isOnline } from '../lib/presence.js';
import { assertReplyTarget } from './messageEdit.service.js';
import { isBlockedBetween, unhideForMembers } from './profile.service.js';

/**
 * Shared by the REST route and the socket handler so both paths persist a
 * message identically. Returns the serialized message plus the member ids the
 * caller should fan the event out to.
 */
/**
 * The client hands back the attachment descriptor it got from /api/upload, so
 * it can't be trusted blindly — a forged payload could point a rendered <img>
 * or download link at any host. Only URLs our own upload endpoint could have
 * produced are accepted.
 */
function sanitizeAttachment(attachment) {
  const url = attachment?.url;
  if (typeof url !== 'string') throw ApiError.badRequest('Invalid attachment');

  const isLocal = url.startsWith('/uploads/') && !url.includes('..');
  const isCloudinary = /^https:\/\/res\.cloudinary\.com\/[\w-]+\//.test(url);
  if (!isLocal && !isCloudinary) throw ApiError.badRequest('Attachment must be an uploaded file');

  return {
    url,
    mime: String(attachment.mime ?? 'application/octet-stream').slice(0, 100),
    size: Number(attachment.size) || 0,
    name: String(attachment.name ?? 'file').slice(0, 120),
    width: Number(attachment.width) || undefined,
    height: Number(attachment.height) || undefined,
  };
}

export async function createMessage({ conversationId, senderId, text, type = 'text', attachment, replyTo }) {
  const body = (text ?? '').trim();

  if (!['text', 'image', 'file'].includes(type)) throw ApiError.badRequest('Unsupported message type');
  if (type === 'text' && !body) throw ApiError.badRequest('Message cannot be empty');
  if (type !== 'text' && !attachment) throw ApiError.badRequest('Attachment is missing');
  if (body.length > 4000) throw ApiError.badRequest('Message is too long');

  const safeAttachment = type === 'text' ? undefined : sanitizeAttachment(attachment);

  // membership check and existence check in one query
  const conversation = await Conversation.findOne({ _id: conversationId, 'members.user': senderId });
  if (!conversation) throw ApiError.notFound('Conversation not found');

  /**
   * Anyone connected right now receives this in the same tick, so they count as
   * delivered immediately — no client round-trip needed for the second tick.
   * Offline members get caught up by markDeliveredOnConnect().
   */
  const deliveredTo = [
    senderId, // the sender has it by definition
    ...conversation.members
      .map((m) => String(m.user))
      .filter((id) => id !== String(senderId) && isOnline(id)),
  ];

  // blocking is only meaningful 1:1 — a group is governed by its admins
  if (conversation.type === 'direct') {
    const peer = conversation.members.find((m) => String(m.user) !== String(senderId));
    if (peer && (await isBlockedBetween(senderId, peer.user))) {
      throw ApiError.forbidden('You can no longer message this person');
    }
  }

  const replyToId = await assertReplyTarget(replyTo, conversation._id);

  const message = await Message.create({
    conversation: conversation._id,
    sender: senderId,
    type,
    text: body,
    attachment: safeAttachment,
    replyTo: replyToId,
    deliveredTo,
    readBy: [senderId],
  });

  // populate the quote so the fan-out event carries the reply preview
  if (replyToId) {
    await message.populate({
      path: 'replyTo',
      select: 'sender type text attachment deletedAt',
      populate: { path: 'sender', select: 'name' },
    });
  }

  conversation.lastMessage = {
    text: type === 'text' ? body : (body || (type === 'image' ? '📷 Photo' : `📎 ${safeAttachment.name}`)),
    type,
    sender: senderId,
    at: message.createdAt,
  };
  await conversation.save();
  // a chat someone deleted from their sidebar comes back when it's alive again
  await unhideForMembers(conversation._id);

  return {
    message: serializeMessage(message),
    memberIds: conversation.members.map((m) => String(m.user)),
    conversation,
  };
}

/**
 * Cursor pagination, newest-first. `before` is a message id — we page by
 * createdAt of that message, then hand the client a chronological page.
 */
export async function listMessages({ conversationId, userId, before, limit = 30 }) {
  const conversation = await Conversation.findOne({
    _id: conversationId,
    'members.user': userId,
  }).select('members');
  if (!conversation) throw ApiError.notFound('Conversation not found');

  // messages this user deleted for themselves are invisible to them only
  const query = { conversation: conversationId, deletedFor: { $ne: userId } };

  // ...as is everything from before they cleared the chat
  const clearedAt = conversation.members.find((m) => String(m.user) === String(userId))?.clearedAt;
  if (clearedAt) query.createdAt = { $gt: clearedAt };

  if (before) {
    const cursor = await Message.findById(before).select('createdAt');
    // merge with the clearedAt floor rather than overwriting it
    if (cursor) query.createdAt = { ...query.createdAt, $lt: cursor.createdAt };
  }

  // fetch one extra to know whether another page exists
  const rows = await Message.find(query)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .populate('sender', 'name avatarUrl')
    .populate({
      path: 'replyTo',
      select: 'sender type text attachment deletedAt',
      populate: { path: 'sender', select: 'name' },
    });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return {
    messages: page.reverse().map(serializeMessage), // oldest → newest for rendering
    hasMore,
    nextCursor: hasMore ? String(page[0]._id) : null,
  };
}
