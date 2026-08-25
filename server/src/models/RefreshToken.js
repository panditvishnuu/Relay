import mongoose from 'mongoose';

/**
 * One row per active session. We store only a SHA-256 hash of the token, so a
 * database leak can't be replayed as a login. Rotation deletes the old row and
 * inserts a new one; a hit on an already-deleted hash means the token was
 * replayed, and every session for that user is revoked.
 */
const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    userAgent: { type: String, default: '' },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Mongo removes expired sessions on its own
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
