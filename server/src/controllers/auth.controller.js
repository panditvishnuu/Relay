import { z } from 'zod';
import { User } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { ApiError, asyncHandler } from '../lib/ApiError.js';
import { env } from '../config/env.js';
import {
  clearRefreshCookie,
  consumeRefreshToken,
  issueRefreshToken,
  revokeRefreshToken,
  setRefreshCookie,
  signAccessToken,
} from '../lib/tokens.js';

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

/** Issues both tokens and returns the standard auth payload. */
async function grantSession(res, user, req) {
  const refreshToken = await issueRefreshToken(user, req.headers['user-agent'] ?? '');
  setRefreshCookie(res, refreshToken);
  return { user: user.toPublic(), accessToken: signAccessToken(user) };
}

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (await User.exists({ email })) throw ApiError.badRequest('That email is already registered');

  const user = await User.create({
    name,
    email,
    passwordHash: await User.hashPassword(password),
    // deterministic placeholder avatar until the user uploads one (chunk 6)
    avatarUrl: `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(email)}&backgroundType=gradientLinear`,
  });

  res.status(201).json(await grantSession(res, user, req));
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+passwordHash');
  // same message either way, so the endpoint can't be used to enumerate emails
  if (!user || !(await user.verifyPassword(password))) {
    throw ApiError.unauthorized('Incorrect email or password');
  }

  res.json(await grantSession(res, user, req));
});

export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[env.refreshCookieName];
  if (!token) throw ApiError.unauthorized('No session');

  let userId;
  try {
    userId = await consumeRefreshToken(token); // rotates: old token is now dead
  } catch {
    clearRefreshCookie(res);
    throw ApiError.unauthorized('Session expired, please log in again');
  }

  const user = await User.findById(userId);
  if (!user) {
    clearRefreshCookie(res);
    throw ApiError.unauthorized('Account no longer exists');
  }

  res.json(await grantSession(res, user, req));
});

export const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.[env.refreshCookieName];
  if (token) await revokeRefreshToken(token);
  clearRefreshCookie(res);
  res.json({ ok: true });
});

/** Signs out every device — used by the "log out everywhere" action. */
export const logoutAll = asyncHandler(async (req, res) => {
  await RefreshToken.deleteMany({ user: req.userId });
  clearRefreshCookie(res);
  res.json({ ok: true });
});

export const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw ApiError.unauthorized('Account no longer exists');
  res.json({ user: user.toPublic() });
});
