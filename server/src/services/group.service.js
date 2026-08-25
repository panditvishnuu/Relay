import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { ApiError } from '../lib/ApiError.js';
import { serializeMessage } from '../lib/serialize.js';

export const MAX_GROUP_MEMBERS = 100;

const populateMembers = (query) =>
  query.populate('members.user', 'name avatarUrl statusText isOnline lastSeen');

/** Throws unless the user is an admin of this group. */
function assertAdmin(conversation, userId) {
  const member = conversation.members.find((m) => String(m.user?._id ?? m.user) === String(userId));
  if (!member) throw ApiError.notFound('Conversation not found');
  if (member.role !== 'admin') throw ApiError.forbidden('Only group admins can do that');
  return member;
}

function assertGroup(conversation) {
  if (!conversation || conversation.type !== 'group') throw ApiError.notFound('Group not found');
}

/**
 * System messages are real messages with type 'system'. Storing them in the
 * thread (rather than as a separate feed) means history, pagination and the
 * sidebar preview all work on them for free.
 */
async function addSystemMessage(conversation, actorId, text) {
  const message = await Message.create({
    conversation: conversation._id,
    sender: actorId,
    type: 'system',
    text,
    // nobody needs to "read" a system line for ticks to make sense
    deliveredTo: conversation.members.map((m) => m.user?._id ?? m.user),
    readBy: [actorId],
  });

  conversation.lastMessage = { text, type: 'system', sender: actorId, at: message.createdAt };
  return serializeMessage(message);
}

// ---------------------------------------------------------------- create

export async function createGroup({ name, memberIds, createdBy }) {
  const unique = [...new Set(memberIds.map(String))].filter((id) => id !== String(createdBy));

  if (unique.length < 1) throw ApiError.badRequest('Add at least one other person');
  if (unique.length + 1 > MAX_GROUP_MEMBERS) {
    throw ApiError.badRequest(`Groups are limited to ${MAX_GROUP_MEMBERS} members`);
  }

  const found = await User.countDocuments({ _id: { $in: unique } });
  if (found !== unique.length) throw ApiError.badRequest('One or more members no longer exist');

  const conversation = await Conversation.create({
    type: 'group',
    name: name.trim(),
    createdBy,
    // the creator starts as the only admin
    members: [{ user: createdBy, role: 'admin' }, ...unique.map((user) => ({ user }))],
  });

  const creator = await User.findById(createdBy).select('name');
  const systemMessage = await addSystemMessage(
    conversation,
    createdBy,
    `${creator.name} created “${conversation.name}”`
  );
  await conversation.save();

  return { conversation: await populateMembers(Conversation.findById(conversation._id)), systemMessage };
}

// ---------------------------------------------------------------- update

export async function renameGroup({ conversationId, userId, name }) {
  const conversation = await populateMembers(Conversation.findById(conversationId));
  assertGroup(conversation);
  assertAdmin(conversation, userId);

  const trimmed = name.trim();
  if (trimmed === conversation.name) return { conversation, systemMessage: null };

  const previous = conversation.name;
  conversation.name = trimmed;

  const actor = await User.findById(userId).select('name');
  const systemMessage = await addSystemMessage(
    conversation,
    userId,
    `${actor.name} renamed the group from “${previous}” to “${trimmed}”`
  );
  await conversation.save();

  return { conversation, systemMessage };
}

// --------------------------------------------------------------- members

export async function addMembers({ conversationId, userId, memberIds }) {
  const conversation = await populateMembers(Conversation.findById(conversationId));
  assertGroup(conversation);
  assertAdmin(conversation, userId);

  const existing = new Set(conversation.members.map((m) => String(m.user?._id ?? m.user)));
  const toAdd = [...new Set(memberIds.map(String))].filter((id) => !existing.has(id));

  if (!toAdd.length) throw ApiError.badRequest('Those people are already in the group');
  if (existing.size + toAdd.length > MAX_GROUP_MEMBERS) {
    throw ApiError.badRequest(`Groups are limited to ${MAX_GROUP_MEMBERS} members`);
  }

  const users = await User.find({ _id: { $in: toAdd } }).select('name');
  if (users.length !== toAdd.length) throw ApiError.badRequest('One or more users no longer exist');

  conversation.members.push(...toAdd.map((user) => ({ user })));

  const actor = await User.findById(userId).select('name');
  const systemMessage = await addSystemMessage(
    conversation,
    userId,
    `${actor.name} added ${users.map((u) => u.name).join(', ')}`
  );
  await conversation.save();

  return {
    conversation: await populateMembers(Conversation.findById(conversationId)),
    systemMessage,
    addedIds: toAdd,
  };
}

/**
 * Handles both "admin removes someone" and "member leaves". Leaving is always
 * allowed; removing someone else needs admin.
 */
export async function removeMember({ conversationId, userId, targetId }) {
  const conversation = await populateMembers(Conversation.findById(conversationId));
  assertGroup(conversation);

  const isSelf = String(userId) === String(targetId);
  if (!isSelf) assertAdmin(conversation, userId);

  const target = conversation.members.find((m) => String(m.user?._id ?? m.user) === String(targetId));
  if (!target) throw ApiError.badRequest('That person is not in this group');
  if (conversation.members.length <= 2) {
    throw ApiError.badRequest('A group needs at least two people — delete it instead');
  }

  const memberIdsBefore = conversation.members.map((m) => String(m.user?._id ?? m.user));
  conversation.members = conversation.members.filter(
    (m) => String(m.user?._id ?? m.user) !== String(targetId)
  );

  /**
   * Never strand a group without an admin: if the last one just left, the
   * longest-standing remaining member is promoted.
   */
  if (!conversation.members.some((m) => m.role === 'admin')) {
    const oldest = [...conversation.members].sort((a, b) => a.joinedAt - b.joinedAt)[0];
    if (oldest) oldest.role = 'admin';
  }

  const actor = await User.findById(userId).select('name');
  const targetUser = await User.findById(targetId).select('name');
  const systemMessage = await addSystemMessage(
    conversation,
    userId,
    isSelf ? `${actor.name} left the group` : `${actor.name} removed ${targetUser.name}`
  );
  await conversation.save();

  return {
    conversation: await populateMembers(Conversation.findById(conversationId)),
    systemMessage,
    // the removed person still needs the event, so they can drop it from their sidebar
    notifyIds: memberIdsBefore,
    removedId: String(targetId),
  };
}
