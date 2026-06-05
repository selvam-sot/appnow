import type { Document } from 'mongoose';
import mongoose, { Schema } from 'mongoose';

export interface IVendorBlockTime extends Document {
  vendorId: mongoose.Types.ObjectId;
  // Inclusive date range when the vendor is unavailable
  fromDate: Date;
  toDate: Date;
  // Whole-day block or specific time window
  allDay: boolean;
  fromTime?: string; // HH:mm — only when allDay = false
  toTime?: string;
  reason?: 'vacation' | 'sick' | 'holiday' | 'training' | 'other';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VendorBlockTimeSchema = new Schema<IVendorBlockTime>(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      index: true,
    },
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
    allDay: { type: Boolean, default: true },
    fromTime: { type: String }, // HH:mm
    toTime: { type: String },
    reason: {
      type: String,
      enum: ['vacation', 'sick', 'holiday', 'training', 'other'],
      default: 'vacation',
    },
    notes: { type: String, trim: true },
  },
  { timestamps: true },
);

// Common query: "is this vendor blocked on date X?"
VendorBlockTimeSchema.index({ vendorId: 1, fromDate: 1, toDate: 1 });

export default mongoose.model<IVendorBlockTime>(
  'VendorBlockTime',
  VendorBlockTimeSchema,
  'vendor_block_times',
);
