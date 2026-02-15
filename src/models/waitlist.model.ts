import mongoose, { Schema, Document } from 'mongoose';

export interface IWaitlist extends Document {
    customerId: mongoose.Types.ObjectId;
    clerkId: string;
    vendorServiceId: mongoose.Types.ObjectId;
    preferredDate: string; // YYYY-MM-DD
    preferredTime?: string; // HH:mm
    status: 'active' | 'notified' | 'expired' | 'booked';
    notifiedAt?: Date;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const WaitlistSchema = new Schema(
    {
        customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        clerkId: { type: String, required: true },
        vendorServiceId: { type: Schema.Types.ObjectId, ref: 'VendorService', required: true },
        preferredDate: { type: String, required: true },
        preferredTime: { type: String },
        status: {
            type: String,
            enum: ['active', 'notified', 'expired', 'booked'],
            default: 'active',
        },
        notifiedAt: { type: Date },
        expiresAt: {
            type: Date,
            required: true,
            default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
    },
    { timestamps: true }
);

WaitlistSchema.index({ vendorServiceId: 1, preferredDate: 1, status: 1 });
WaitlistSchema.index({ clerkId: 1, status: 1 });
WaitlistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index - auto-delete expired

const Waitlist = mongoose.model<IWaitlist>('Waitlist', WaitlistSchema);
export default Waitlist;
