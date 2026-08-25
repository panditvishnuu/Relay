import { z } from 'zod';
import mongoose from 'mongoose';
import { Conversation, buildDirectKey } from '../models/Conversation.js';
import { User } from '../models/User.js';
import { ApiError, asyncHandler } from '../lib/ApiError.js';
import { serializeConversation } from '../lib/serialize.js';
import { listMessages } from '../services/message.service.js';
import { unreadCounts } from '../services/receipt.service.js';
import { listMedia } from '../services/reaction.service.js';

export const directSchema = z.object({
  userId: z.string().refine(mongoose.isValidObjectId, 'Invalid user id'),
});

const withMembers = (query) => query.populate('members.user', 'name avatarUrl statusText isOnline lastSeen');

export const list = asyncHandler(async (req, res) => {
  const all = await withMembers(
    Conversation.find({ 'members.user': req.userId }).sort({ 'lastMessage.at': -1, updatedAt: -1 })
  );

  // a chat the user deleted stays out of the list until something newer arrives
  const conversations = all.filter((c) => {
    const me = c.members.find((m) => String(m.user?._id ?? m.user) === String(req.userId));
    if (!me?.hiddenAt) return true;
    return c.lastMessage?.at && c.lastMessage.at > me.hiddenAt;
  });

  // one aggregation for the whole sidebar, not one count per row
  const unread = await unreadCounts(conversations, req.userId);

  res.json({
    conversations: conversations.map((c) =>
      serializeConversation(c, req.userId, unread.get(String(c._id)) ?? 0)
    ),
  });
});

/** Idempotent: opening a chat you already have returns the existing thread. */
export const createDirect = asyncHandler(async (req, res) => {
  const { userId } = req.body;
  if (String(userId) === String(req.userId)) throw ApiError.badRequest('You cannot message yourself');

  const peer = await User.findById(userId);
  if (!peer) throw ApiError.notFound('User not found');

  const directKey = buildDirectKey(req.userId, userId);

  let conversation = await withMembers(Conversation.findOne({ directKey }));
  let created = false;

  if (!conversation) {
    try {
      conversation = await Conversation.create({
        type: 'direct',
        directKey,
        members: [{ user: req.userId }, { user: userId }],
      });
      created = true;
    } catch (err) {
      // unique index lost a race with a simultaneous open from the other side
      if (err.code !== 11000) throw err;
    }
    conversation = await withMembers(Conversation.findOne({ directKey }));
  }

  res
    .status(created ? 201 : 200)
    .json({ conversation: serializeConversation(conversation, req.userId) });
});

export const getOne = asyncHandler(async (req, res) => {
  const conversation = await withMembers(
    Conversation.findOne({ _id: req.params.id, 'members.user': req.userId })
  );
  if (!conversation) throw ApiError.notFound('Conversation not found');

  res.json({ conversation: serializeConversation(conversation, req.userId) });
});

export const getMessages = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 30, 100);

  const page = await listMessages({
    conversationId: req.params.id,
    userId: req.userId,
    before: req.query.before,
    limit,
  });

  res.json(page);
});

export const getMedia = asyncHandler(async (req, res) => {
  const media = await listMedia({ conversationId: req.params.id, userId: req.userId });
  res.json({ media });
});
