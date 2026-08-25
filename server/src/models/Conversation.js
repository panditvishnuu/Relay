import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['member', 'admin'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
    // chunk 4 compares this against message timestamps to compute unread counts
    lastReadAt: { type: Date, default: null },

    /**
     * Per-member view state, both timestamps rather than bulk row edits:
     *   clearedAt — hides everything sent before it, for this member only
     *   hiddenAt  — drops the conversation from their sidebar until something
     *               newer arrives, at which point it reappears on its own
     * A "clear chat" over 10k messages is one field write, not 10k.
     */
    clearedAt: { type: Date, default: null },
    hiddenAt: { type: Date, default: null },
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['direct', 'group'], required: true },
    members: { type: [memberSchema], required: true },

    // group-only
    name: { type: String, trim: true, maxlength: 60 },
    avatarUrl: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    /**
     * Sorted "idA:idB" for direct chats. The unique index is what stops two
     * people who message each other simultaneously from creating two threads.
     */
    directKey: { type: String, default: undefined },

    // denormalised so the sidebar renders without touching the messages collection
    lastMessage: {
      text: String,
      type: { type: String, enum: ['text', 'image', 'file', 'system'] },
      sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      at: Date,
    },
  },
  { timestamps: true }
);

conversationSchema.index({ 'members.user': 1, 'lastMessage.at': -1 });
conversationSchema.index({ directKey: 1 }, { unique: true, sparse: true });

/** Stable key for a pair of users, order-independent. */
export const buildDirectKey = (a, b) => [String(a), String(b)].sort().join(':');

export const Conversation = mongoose.model('Conversation', conversationSchema);
