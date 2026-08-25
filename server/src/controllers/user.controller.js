import { User } from '../models/User.js';
import { asyncHandler } from '../lib/ApiError.js';
import { serializeUser } from '../lib/serialize.js';

/** Escapes a user-supplied string so it can't inject regex syntax. */
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * GET /api/users?search=ann
 * Prefix-matches name or email. Empty search returns recent users, so the
 * "new chat" dialog has something to show before the user types.
 */
export const search = asyncHandler(async (req, res) => {
  const term = (req.query.search ?? '').trim();
  const limit = Math.min(Number(req.query.limit) || 20, 50);

  const filter = { _id: { $ne: req.userId } };
  if (term) {
    const pattern = new RegExp(escapeRegex(term), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }];
  }

  const users = await User.find(filter).sort({ isOnline: -1, name: 1 }).limit(limit);
  res.json({ users: users.map(serializeUser) });
});

export const getOne = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  res.json({ user: serializeUser(user) });
});
