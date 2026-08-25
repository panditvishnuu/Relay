import { z } from 'zod';
import mongoose from 'mongoose';
import { asyncHandler } from '../lib/ApiError.js';
import { serializeConversation } from '../lib/serialize.js';
import { addMembers, createGroup, removeMember, renameGroup } from '../services/group.service.js';
import { getIO } from '../socket/index.js';
import { userRoom } from '../socket/rooms.js';

const objectId = z.string().refine(mongoose.isValidObjectId, 'Invalid id');

export const createGroupSchema = z.object({
  name: z.string().trim().min(2, 'Group name must be at least 2 characters').max(60),
  memberIds: z.array(objectId).min(1, 'Pick at least one person'),
});

export const renameGroupSchema = z.object({
  name: z.string().trim().min(2, 'Group name must be at least 2 characters').max(60),
});

export const addMembersSchema = z.object({
  memberIds: z.array(objectId).min(1, 'Pick at least one person'),
});

/**
 * Group changes fan out to a list of user ids rather than the conversation's
 * current members — a removal has to reach the person who just left, and they
 * are no longer in the member list.
 */
function broadcast(notifyIds, conversation, systemMessage, extra = {}) {
  const io = getIO();
  if (!io) return;

  for (const memberId of notifyIds) {
    io.to(userRoom(memberId)).emit('conversation:updated', {
      conversation: serializeConversation(conversation, memberId, null),
      systemMessage,
      ...extra,
    });
  }
}

export const create = asyncHandler(async (req, res) => {
  const { conversation, systemMessage } = await createGroup({
    name: req.body.name,
    memberIds: req.body.memberIds,
    createdBy: req.userId,
  });

  const memberIds = conversation.members.map((m) => String(m.user._id));
  broadcast(memberIds, conversation, systemMessage, { created: true });

  res.status(201).json({ conversation: serializeConversation(conversation, req.userId, 0) });
});

export const rename = asyncHandler(async (req, res) => {
  const { conversation, systemMessage } = await renameGroup({
    conversationId: req.params.id,
    userId: req.userId,
    name: req.body.name,
  });

  broadcast(conversation.members.map((m) => String(m.user._id)), conversation, systemMessage);
  res.json({ conversation: serializeConversation(conversation, req.userId, 0) });
});

export const addPeople = asyncHandler(async (req, res) => {
  const { conversation, systemMessage } = await addMembers({
    conversationId: req.params.id,
    userId: req.userId,
    memberIds: req.body.memberIds,
  });

  broadcast(conversation.members.map((m) => String(m.user._id)), conversation, systemMessage);
  res.json({ conversation: serializeConversation(conversation, req.userId, 0) });
});

export const removePerson = asyncHandler(async (req, res) => {
  const { conversation, systemMessage, notifyIds, removedId } = await removeMember({
    conversationId: req.params.id,
    userId: req.userId,
    targetId: req.params.userId,
  });

  broadcast(notifyIds, conversation, systemMessage, { removedId });

  const left = String(removedId) === String(req.userId);
  res.json({
    left,
    conversation: left ? null : serializeConversation(conversation, req.userId, 0),
  });
});
