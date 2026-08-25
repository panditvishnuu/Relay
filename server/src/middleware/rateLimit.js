import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { isDev } from '../config/env.js';
import { ApiError } from '../lib/ApiError.js';

/**
 * Limits are deliberately per-route rather than one global cap: login needs to
 * be strict enough to make credential stuffing impractical, while a chat client
 * legitimately makes a lot of ordinary reads.
 *
 * Disabled in development, where hot reload and verification scripts would trip
 * them constantly.
 */
const build = ({ windowMs, max, message }) =>
  rateLimit({
    windowMs,
    limit: max,
    /**
     * `skip`, not `limit: 0` — in express-rate-limit v7 a limit of 0 blocks
     * every request rather than disabling the limiter, which silently 429s the
     * whole app in development.
     */
    skip: () => isDev,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    /**
     * Key on the authenticated user when we have one, otherwise the IP.
     * ipKeyGenerator normalises IPv6 to its /64 prefix — a raw req.ip would let
     * anyone with an IPv6 allocation sidestep the limit by rotating addresses
     * within their own subnet.
     */
    keyGenerator: (req) => req.userId ?? ipKeyGenerator(req.ip),
    handler: (req, res, next) => next(new ApiError(429, message)),
  });

/** Login and register: slow enough that guessing passwords isn't viable. */
export const authLimiter = build({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many attempts. Try again in a few minutes.',
});

/** Refresh runs on every page load, so it needs more headroom than login. */
export const refreshLimiter = build({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many session refreshes. Try again shortly.',
});

/** Everything else. Generous — a busy client polls and paginates. */
export const apiLimiter = build({
  windowMs: 60 * 1000,
  max: 300,
  message: 'Slow down a moment.',
});

/** Uploads are the expensive path: bandwidth, storage and a third party. */
export const uploadLimiter = build({
  windowMs: 60 * 60 * 1000,
  max: 60,
  message: 'Upload limit reached. Try again later.',
});
