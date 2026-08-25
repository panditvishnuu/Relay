import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { ApiError } from '../lib/ApiError.js';

/**
 * A rough emoji check. The point isn't perfect Unicode coverage — it's to stop
 * the reactions field being used to store arbitrary text.
 */
const EMOJI_RE = /^(\p{Extended_Pictographic}|\p{Emoji_Presentation})(‍(\p{Extended_Pictographic}|\p{Emoji_Presentation})|[️\u{1F3FB}-\u{1F3FF}])*$/u;

/**
 * Toggles one reaction. Clicking the same emoji again removes it; a different
 * emoji replaces your previous one, so a person contributes at most one
 * reaction per message.
 */
export async function toggleReaction({ messageId, userId, emoji }) {
  if (!EMOJI_RE.test(emoji ?? '')) throw ApiError.badRequest('That is not an emoji');

  const message = await Message.findById(messageId);
  if (!message) throw ApiError.notFound('Message not found');
  if (message.type === 'system') throw ApiError.badRequest('System messages cannot be reacted to');

  const isMember = await Conversation.exists({
    _id: message.conversation,
    'members.user': userId,
  });
  if (!isMember) throw ApiError.notFound('Message not found');

  const mine = message.reactions.find((r) => String(r.user) === String(userId));
  const removed = mine?.emoji === emoji;

  message.reactions = message.reactions.filter((r) => String(r.user) !== String(userId));
  if (!removed) message.reactions.push({ user: userId, emoji });

  await message.save();

  return {
    conversationId: String(message.conversation),
    messageId: String(message._id),
    reactions: message.reactions.map((r) => ({ user: String(r.user), emoji: r.emoji })),
    removed,
  };
}

/** Every image and file in a conversation, newest first — powers the media grid. */
export async function listMedia({ conversationId, userId, limit = 60 }) {
  const isMember = await Conversation.exists({ _id: conversationId, 'members.user': userId });
  if (!isMember) throw ApiError.notFound('Conversation not found');

  const messages = await Message.find({
    conversation: conversationId,
    type: { $in: ['image', 'file'] },
    'attachment.url': { $exists: true },
  })
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 200))
    .select('type attachment createdAt sender');

  return messages.map((m) => ({
    _id: m._id,
    type: m.type,
    attachment: m.attachment,
    createdAt: m.createdAt,
    senderId: m.sender,
  }));
}
