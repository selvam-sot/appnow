import type { Document } from 'mongoose';
import mongoose, { Schema } from 'mongoose';

export interface IVendorPayout extends Document {
  vendorId: mongoose.Types.ObjectId;
  appointmentId?: mongoose.Types.ObjectId;
  // Amounts in cents (matches Stripe convention)
  grossAmount: number; // What customer paid (excluding tax)
  platformFee: number; // Commission taken by platform
  taxAmount: number; // Sales tax collected (not paid to vendor)
  netAmount: number; // grossAmount - platformFee = paid to vendor
  currency: string; // 'usd'
  // Status of the payout
  status: 'pending' | 'in_transit' | 'paid' | 'failed' | 'reversed' | 'canceled';
  // Stripe references
  stripePaymentIntentId?: string; // Source payment
  stripeTransferId?: string; // Transfer from platform to connected account
  stripePayoutId?: string; // Final payout from connected account to bank
  failureReason?: string;
  // Audit
  createdAt: Date;
  paidAt?: Date;
  failedAt?: Date;
}

const VendorPayoutSchema = new Schema<IVendorPayout>(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      index: true,
    },
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
      index: true,
    },
    grossAmount: { type: Number, required: true },
    platformFee: { type: Number, required: true, default: 0 },
    taxAmount: { type: Number, required: true, default: 0 },
    netAmount: { type: Number, required: true },
    currency: { type: String, required: true, default: 'usd' },
    status: {
      type: String,
      enum: ['pending', 'in_transit', 'paid', 'failed', 'reversed', 'canceled'],
      default: 'pending',
      index: true,
    },
    stripePaymentIntentId: { type: String, index: true },
    stripeTransferId: { type: String, index: true },
    stripePayoutId: { type: String, index: true },
    failureReason: { type: String },
    paidAt: { type: Date },
    failedAt: { type: Date },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  },
);

// Compound indexes for common queries
VendorPayoutSchema.index({ vendorId: 1, status: 1 });
VendorPayoutSchema.index({ vendorId: 1, createdAt: -1 });

export default mongoose.model<IVendorPayout>(
  'VendorPayout',
  VendorPayoutSchema,
  'vendor_payouts',
);
