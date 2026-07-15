import type { Document } from 'mongoose';
import mongoose, { Schema } from 'mongoose';

/**
 * Staff — individual service providers working under a vendor account.
 *
 * Examples:
 *   - Bella's Nail Salon has 3 nail techs (Maria, Priya, Jess)
 *   - A dental clinic has 4 doctors (each is a Staff)
 *   - Solo freelancers have zero Staff records (or a single one representing themselves)
 *
 * Customers can pick a specific staff member at booking, or "No preference"
 * which lets the server auto-assign at confirmation time.
 *
 * Availability model:
 *   - `workingHours` defines the staff's weekly recurring schedule
 *   - `serviceIds` limits which of the vendor's services this staff can deliver
 *   - Slot availability is filtered by (vendorService allowed AND workingHours)
 */

export interface StaffWorkingHours {
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  startTime: string; // "09:00"
  endTime: string;   // "17:00"
}

export interface IStaff {
  vendorId: mongoose.Types.ObjectId;
  name: string;
  photo?: string;
  bio?: string;
  specializations?: string[];
  // Empty array means "can deliver all vendor services". Populate to restrict.
  serviceIds?: mongoose.Types.ObjectId[];
  workingHours?: StaffWorkingHours[];
  // Aggregated stats — refreshed on appointment complete
  rating?: number;
  reviewCount?: number;
  totalCompletedAppointments?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const WorkingHoursSchema = new Schema<StaffWorkingHours>(
  {
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
  },
  { _id: false },
);

const StaffSchema = new Schema<IStaff & Document>(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    photo: { type: String },
    bio: { type: String },
    specializations: [{ type: String }],
    serviceIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'VendorService',
      },
    ],
    workingHours: [WorkingHoursSchema],
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },
    totalCompletedAppointments: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

// Compound index for "active staff for a vendor" queries — the common case
StaffSchema.index({ vendorId: 1, isActive: 1 });

export default mongoose.model<IStaff & Document>('Staff', StaffSchema);
