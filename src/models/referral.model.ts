import mongoose, { Schema, Document } from 'mongoose';

export interface IReferral extends Document {
    referrerId: string;
    referredClerkId: string;
    referralCode: string;
    status: 'pending' | 'completed' | 'rewarded';
    rewardGiven: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const ReferralSchema = new Schema(
    {
        referrerId: { type: String, required: true },
        referredClerkId: { type: String, required: true },
        referralCode: { type: String, required: true, unique: true },
        status: {
            type: String,
            enum: ['pending', 'completed', 'rewarded'],
            default: 'pending',
        },
        rewardGiven: { type: Boolean, default: false },
    },
    { timestamps: true }
);

ReferralSchema.index({ referrerId: 1 });
ReferralSchema.index({ referredClerkId: 1 });
ReferralSchema.index({ referralCode: 1 });

const Referral = mongoose.model<IReferral>('Referral', ReferralSchema);
export default Referral;
