import type { Document } from 'mongoose';
import mongoose, { Schema } from 'mongoose';

/**
 * Message — a single chat entry within a Conversation.
 *
 * Kept lean: text-only for MVP. Attachments (photos, files) go to the
 * `attachmentUrls` array; the client uploads to storage and posts URLs.
 * `readAt` is stamped when the recipient opens the conversation.
 */

export interface IMessage {
  conversationId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  senderRole: 'customer' | 'vendor';
  content: string;
  attachmentUrls?: string[];
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage & Document>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    senderRole: {
      type: String,
      enum: ['customer', 'vendor'],
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 4000,
      trim: true,
    },
    attachmentUrls: [{ type: String }],
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Common query: paginated messages for a thread newest-first
MessageSchema.index({ conversationId: 1, createdAt: -1 });

export default mongoose.model<IMessage & Document>('Message', MessageSchema);
