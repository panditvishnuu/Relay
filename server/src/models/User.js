import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // never returned unless explicitly selected
    passwordHash: { type: String, required: true, select: false },
    avatarUrl: { type: String, default: '' },
    statusText: { type: String, default: 'Hey there! I am on Relay.', maxlength: 140 },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },

    // people this user has blocked; enforced on send in both directions
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

// powers the user search in chunk 3
userSchema.index({ name: 'text', email: 'text' });

userSchema.statics.hashPassword = (plain) => bcrypt.hash(plain, BCRYPT_ROUNDS);

userSchema.methods.verifyPassword = function verifyPassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

/** The only user shape that ever crosses the wire. */
userSchema.methods.toPublic = function toPublic() {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    avatarUrl: this.avatarUrl,
    statusText: this.statusText,
    isOnline: this.isOnline,
    lastSeen: this.lastSeen,
  };
};

export const User = mongoose.model('User', userSchema);
