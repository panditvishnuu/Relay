import { z } from 'zod';
import mongoose from 'mongoose';
import { asyncHandler } from '../lib/ApiError.js';
import { serializeUser } from '../lib/serialize.js';
import { User } from '../models/User.js';
import {
  clearConversation,
  contactIdsOf,
  hideConversation,
  setBlocked,
  updateProfile,
} from '../services/profile.service.js';
import { getIO } from '../socket/index.js';
import { userRoom } from '../socket/rooms.js';

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60).optional(),
    statusText: z.string().trim().max(140, 'Status is too long').optional(),
    avatarUrl: z.string().max(500).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

export const updateMe = asyncHandler(async (req, res) => {
  const user = await updateProfile({ userId: req.userId, ...req.body });
  const payload = serializeUser(user);

  /**
   * Everyone who shares a conversation renders this user's name and avatar, so
   * they all need the new copy — otherwise a rename only appears after a
   * refresh, or worse, inconsistently across panes.
   */
  const io = getIO();
  if (io) {
    for (const contactId of await contactIdsOf(req.userId)) {
      io.to(userRoom(contactId)).emit('user:updated', { user: payload });
    }
    // and this user's own other tabs
    io.to(userRoom(req.userId)).emit('user:updated', { user: payload, self: true });
  }

  res.json({ user: payload });
});

export const blocked = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId).populate('blockedUsers', 'name avatarUrl statusText');
  res.json({ blocked: (user?.blockedUsers ?? []).map(serializeUser) });
});

export const block = asyncHandler(async (req, res) => {
  const result = await setBlocked({ userId: req.userId, targetId: req.params.id, blocked: true });
  res.json(result);
});

export const unblock = asyncHandler(async (req, res) => {
  const result = await setBlocked({ userId: req.userId, targetId: req.params.id, blocked: false });
  res.json(result);
});

export const clearChat = asyncHandler(async (req, res) => {
  const result = await clearConversation({ conversationId: req.params.id, userId: req.userId });

  // other tabs of the same user should empty the thread too
  getIO()?.to(userRoom(req.userId)).emit('conversation:cleared', result);
  res.json(result);
});

export const deleteChat = asyncHandler(async (req, res) => {
  const result = await hideConversation({ conversationId: req.params.id, userId: req.userId });

  getIO()?.to(userRoom(req.userId)).emit('conversation:hidden', result);
  res.json(result);
});

export const objectIdParam = z.string().refine(mongoose.isValidObjectId, 'Invalid id');
