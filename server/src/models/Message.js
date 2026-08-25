import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['text', 'image', 'file', 'system'], default: 'text' },
    text: { type: String, trim: true, maxlength: 4000 },

    // chunk 6
    attachment: {
      url: String,
      mime: String,
      size: Number,
      name: String,
      width: Number,
      height: Number,
    },

    // chunk 4
    deliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },

    /**
     * Two kinds of delete:
     *   deletedAt   — "delete for everyone": the row stays so the thread keeps
     *                 its shape, but the content is stripped and a tombstone
     *                 renders in its place.
     *   deletedFor  — "delete for me": per-user hide, invisible to others.
     */
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    reactions: [
      {
        _id: false,
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        emoji: String,
      },
    ],
  },
  { timestamps: true }
);

// the cursor-pagination index: newest-first within a conversation
messageSchema.index({ conversation: 1, createdAt: -1 });

export const Message = mongoose.model('Message', messageSchema);
