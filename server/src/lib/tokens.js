import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env, isProd } from '../config/env.js';
import { RefreshToken } from '../models/RefreshToken.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

/** Short-lived, sent in the JSON body and held only in browser memory. */
export function signAccessToken(user) {
  return jwt.sign({ name: user.name }, env.accessTokenSecret, {
    subject: String(user._id),
    expiresIn: env.accessTokenTtl,
  });
}

export const verifyAccessToken = (token) => jwt.verify(token, env.accessTokenSecret);

/**
 * Issues a refresh token and records its hash as a session row.
 * `jti` makes every token unique even for back-to-back refreshes.
 */
export async function issueRefreshToken(user, userAgent = '') {
  const expiresAt = new Date(Date.now() + env.refreshTokenTtlDays * DAY_MS);
  const token = jwt.sign({ jti: crypto.randomUUID() }, env.refreshTokenSecret, {
    subject: String(user._id),
    expiresIn: `${env.refreshTokenTtlDays}d`,
  });

  await RefreshToken.create({ user: user._id, tokenHash: sha256(token), userAgent, expiresAt });
  return token;
}

/**
 * Verifies signature, then consumes the session row.
 * Returns the userId, or throws — including on replay of a rotated token,
 * which nukes every session for that user.
 */
export async function consumeRefreshToken(token) {
  const payload = jwt.verify(token, env.refreshTokenSecret);
  const deleted = await RefreshToken.findOneAndDelete({ tokenHash: sha256(token) });

  if (!deleted) {
    // valid signature but no session row => already rotated or revoked
    await RefreshToken.deleteMany({ user: payload.sub });
    throw new Error('Refresh token reuse detected');
  }
  return payload.sub;
}

export const revokeRefreshToken = (token) => RefreshToken.deleteOne({ tokenHash: sha256(token) });

export function setRefreshCookie(res, token) {
  res.cookie(env.refreshCookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/api/auth',
    maxAge: env.refreshTokenTtlDays * DAY_MS,
  });
}

export function clearRefreshCookie(res) {
  res.clearCookie(env.refreshCookieName, { httpOnly: true, sameSite: 'lax', secure: isProd, path: '/api/auth' });
}
