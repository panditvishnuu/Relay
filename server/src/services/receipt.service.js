import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { ApiError } from '../lib/ApiError.js';

/**
 * Delivered vs read:
 *   delivered — the server handed it to a connected client
 *   read      — the recipient actually had the thread open and looked at it
 *
 * Both are stored as arrays of user ids on the message, because a group needs
 * to know *who* has seen it, not just how many.
 */

/**
 * Catch-up pass when a user connects: everything sent to them while they were
 * offline becomes delivered. Returns the receipts to broadcast, grouped by
 * conversation, so senders can flip their single tick to a double.
 */
export async function markDeliveredOnConnect(userId) {
  const conversations = await Conversation.find({ 'members.user': userId }).select('_id');
  if (!conversations.length) return [];

  const conversationIds = conversations.map((c) => c._id);

  const pending = await Message.find({
    conversation: { $in: conversationIds },
    sender: { $ne: userId },
    deliveredTo: { $ne: userId },
  }).select('_id conversation');

  if (!pending.length) return [];

  await Message.updateMany(
    { _id: { $in: pending.map((m) => m._id) } },
    { $addToSet: { deliveredTo: userId } }
  );

  // group into one receipt per conversation
  const byConversation = new Map();
  for (const message of pending) {
    const key = String(message.conversation);
    if (!byConversation.has(key)) byConversation.set(key, []);
    byConversation.get(key).push(String(message._id));
  }

  return [...byConversation].map(([conversationId, messageIds]) => ({
    conversationId,
    userId: String(userId),
    messageIds,
  }));
}

/**
 * Marks everything up to `lastMessageId` as read by this user, and stamps
 * `lastReadAt` on their membership row — that timestamp is what the unread
 * badge counts against.
 */
export async function markRead({ conversationId, userId, lastMessageId }) {
  const conversation = await Conversation.findOne({
    _id: conversationId,
    'members.user': userId,
  });
  if (!conversation) throw ApiError.notFound('Conversation not found');

  const boundary = lastMessageId
    ? await Message.findById(lastMessageId).select('createdAt')
    : null;
  const readUpTo = boundary?.createdAt ?? new Date();

  const unread = await Message.find({
    conversation: conversationId,
    sender: { $ne: userId },
    createdAt: { $lte: readUpTo },
    readBy: { $ne: userId },
  }).select('_id');

  if (unread.length) {
    await Message.updateMany(
      { _id: { $in: unread.map((m) => m._id) } },
      // reading implies delivery, so backfill both
      { $addToSet: { readBy: userId, deliveredTo: userId } }
    );
  }

  const member = conversation.members.find((m) => String(m.user) === String(userId));
  if (member && (!member.lastReadAt || member.lastReadAt < readUpTo)) {
    member.lastReadAt = readUpTo;
    await conversation.save();
  }

  return {
    conversationId: String(conversationId),
    userId: String(userId),
    messageIds: unread.map((m) => String(m._id)),
    readUpTo,
    memberIds: conversation.members.map((m) => String(m.user)),
  };
}

/**
 * Unread counts for a user's whole sidebar in one aggregation, rather than one
 * count query per conversation.
 */
export async function unreadCounts(conversations, userId) {
  const clauses = conversations
    .map((conversation) => {
      const member = conversation.members.find((m) => String(m.user?._id ?? m.user) === String(userId));
      return {
        conversation: conversation._id,
        createdAt: { $gt: member?.lastReadAt ?? new Date(0) },
      };
    })
    .filter(Boolean);

  if (!clauses.length) return new Map();

  const rows = await Message.aggregate([
    { $match: { $or: clauses, sender: { $ne: toObjectId(userId) } } },
    { $group: { _id: '$conversation', count: { $sum: 1 } } },
  ]);

  return new Map(rows.map((r) => [String(r._id), r.count]));
}

// aggregate() skips Mongoose casting, so the id has to be a real ObjectId
function toObjectId(id) {
  return typeof id === 'string' ? new (Conversation.base.Types.ObjectId)(id) : id;
}
