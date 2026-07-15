import type { Document } from 'mongoose';
import mongoose, { Schema } from 'mongoose';

/**
 * Wallet transaction ledger. Every credit/debit against a customer's
 * store-credit balance is written here so operations can audit the
 * history. The running balance lives on User.walletBalance for O(1)
 * reads — this collection is the source of truth if a reconciliation
 * is needed.
 */

export type WalletTransactionType = 'credit' | 'debit';
export type WalletTransactionReason =
  | 'goodwill'
  | 'refund_alternative'
  | 'promotional'
  | 'referral_reward'
  | 'loyalty_redemption'
  | 'appointment_payment'
  | 'admin_adjustment'
  | 'other';

export interface IWalletTransaction {
  userId: mongoose.Types.ObjectId;
  type: WalletTransactionType;
  amount: number; // positive dollars
  reason: WalletTransactionReason;
  note?: string;
  adminId?: mongoose.Types.ObjectId; // who issued the credit
  appointmentId?: mongoose.Types.ObjectId; // linked appointment if any
  balanceAfter: number; // snapshot for auditability
  createdAt: Date;
}

const WalletTransactionSchema = new Schema<IWalletTransaction & Document>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ['credit', 'debit'],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01,
  },
  reason: {
    type: String,
    enum: [
      'goodwill',
      'refund_alternative',
      'promotional',
      'referral_reward',
      'loyalty_redemption',
      'appointment_payment',
      'admin_adjustment',
      'other',
    ],
    required: true,
  },
  note: { type: String },
  adminId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  appointmentId: {
    type: Schema.Types.ObjectId,
    ref: 'Appointment',
  },
  balanceAfter: {
    type: Number,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

WalletTransactionSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model<IWalletTransaction & Document>(
  'WalletTransaction',
  WalletTransactionSchema,
);
