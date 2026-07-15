import type { Document } from 'mongoose';
import mongoose, { Schema } from 'mongoose';

/**
 * Conversation — a chat thread between a customer and a vendor.
 *
 * We enforce uniqueness on the (customerId, vendorId) pair so repeat
 * customers reuse the same thread rather than piling up empty threads.
 * The last-message snapshot is denormalized here so the thread list
 * doesn't need a join per row.
 *
 * Not tied to a specific appointment on purpose — customers commonly
 * chat with a vendor about scheduling before booking, or ask follow-ups
 * about past appointments.
 */

export interface IConversation {
  customerId: mongoose.Types.ObjectId;
  vendorId: mongoose.Types.ObjectId;
  // Denormalized latest-message snapshot for list rendering
  lastMessageAt?: Date;
  lastMessagePreview?: string;
  lastMessageSenderRole?: 'customer' | 'vendor';
  // Unread counts per party
  customerUnreadCount: number;
  vendorUnreadCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation & Document>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      index: true,
    },
    lastMessageAt: { type: Date, index: true },
    lastMessagePreview: { type: String, maxlength: 200 },
    lastMessageSenderRole: { type: String, enum: ['customer', 'vendor'] },
    customerUnreadCount: { type: Number, default: 0 },
    vendorUnreadCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// One thread per (customer, vendor) pair
ConversationSchema.index({ customerId: 1, vendorId: 1 }, { unique: true });

// Common queries: list a user's threads sorted by recency
ConversationSchema.index({ customerId: 1, lastMessageAt: -1 });
ConversationSchema.index({ vendorId: 1, lastMessageAt: -1 });

export default mongoose.model<IConversation & Document>('Conversation', ConversationSchema);
