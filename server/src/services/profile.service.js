import { Conversation } from '../models/Conversation.js';
import { User } from '../models/User.js';
import { ApiError } from '../lib/ApiError.js';

/**
 * Avatars come back from /api/upload, so the URL can be forged the same way an
 * attachment can. Same allowlist: our own uploads, or Cloudinary. The dicebear
 * default assigned at registration is also permitted.
 */
export function sanitizeAvatarUrl(url) {
  if (!url) return '';
  if (typeof url !== 'string') throw ApiError.badRequest('Invalid avatar');

  const allowed =
    (url.startsWith('/uploads/') && !url.includes('..')) ||
    /^https:\/\/res\.cloudinary\.com\/[\w-]+\//.test(url) ||
    /^https:\/\/api\.dicebear\.com\//.test(url);

  if (!allowed) throw ApiError.badRequest('Avatar must be an uploaded image');
  return url;
}

export async function updateProfile({ userId, name, statusText, avatarUrl }) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.unauthorized('Account no longer exists');

  if (name !== undefined) user.name = name.trim();
  if (statusText !== undefined) user.statusText = statusText.trim();
  if (avatarUrl !== undefined) user.avatarUrl = sanitizeAvatarUrl(avatarUrl);

  await user.save();
  return user;
}

/**
 * Everyone who shares a conversation with this user — the audience for a
 * profile change, since they're the only people rendering their name or avatar.
 */
export async function contactIdsOf(userId) {
  const conversations = await Conversation.find({ 'members.user': userId }).select('members.user');

  const ids = new Set();
  for (const conversation of conversations) {
    for (const member of conversation.members) ids.add(String(member.user));
  }
  ids.delete(String(userId));
  return [...ids];
}

// ------------------------------------------------------------------ blocking

export async function setBlocked({ userId, targetId, blocked }) {
  if (String(userId) === String(targetId)) throw ApiError.badRequest('You cannot block yourself');

  const target = await User.exists({ _id: targetId });
  if (!target) throw ApiError.notFound('User not found');

  await User.updateOne(
    { _id: userId },
    blocked ? { $addToSet: { blockedUsers: targetId } } : { $pull: { blockedUsers: targetId } }
  );

  return { targetId: String(targetId), blocked };
}

/**
 * True if either party has blocked the other. Checked on send, so blocking is
 * symmetric in effect: neither can reach the other while it stands.
 */
export async function isBlockedBetween(a, b) {
  const conflict = await User.exists({
    $or: [
      { _id: a, blockedUsers: b },
      { _id: b, blockedUsers: a },
    ],
  });
  return Boolean(conflict);
}

// ------------------------------------------------- clearing / hiding a chat

/** Hides everything currently in the thread, for this member only. */
export async function clearConversation({ conversationId, userId }) {
  const result = await Conversation.updateOne(
    { _id: conversationId, 'members.user': userId },
    { $set: { 'members.$.clearedAt': new Date() } }
  );
  if (!result.matchedCount) throw ApiError.notFound('Conversation not found');
  return { conversationId: String(conversationId) };
}

/**
 * Removes it from this user's sidebar. The conversation itself survives — the
 * other person's copy is untouched, and a new message un-hides it.
 */
export async function hideConversation({ conversationId, userId }) {
  const now = new Date();
  const result = await Conversation.updateOne(
    { _id: conversationId, 'members.user': userId },
    { $set: { 'members.$.hiddenAt': now, 'members.$.clearedAt': now } }
  );
  if (!result.matchedCount) throw ApiError.notFound('Conversation not found');
  return { conversationId: String(conversationId) };
}

/** Called when a message lands, so a hidden chat comes back into view. */
export function unhideForMembers(conversationId) {
  return Conversation.updateOne(
    { _id: conversationId },
    { $set: { 'members.$[].hiddenAt': null } }
  );
}
