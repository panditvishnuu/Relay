import { ApiError } from '../lib/ApiError.js';
import { verifyAccessToken } from '../lib/tokens.js';

/** Populates req.userId from the `Authorization: Bearer <accessToken>` header. */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return next(ApiError.unauthorized('Missing access token'));

  try {
    req.userId = verifyAccessToken(token).sub;
    next();
  } catch (err) {
    // the client interceptor treats 401 as "try refreshing once"
    next(ApiError.unauthorized(err.name === 'TokenExpiredError' ? 'Access token expired' : 'Invalid access token'));
  }
}
