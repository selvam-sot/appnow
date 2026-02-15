import mongoose, { Schema, Document } from 'mongoose';

export interface ILoyaltyTransaction {
    type: 'earned' | 'redeemed' | 'bonus' | 'referral';
    points: number;
    description: string;
    appointmentId?: mongoose.Types.ObjectId;
    createdAt: Date;
}

export interface ILoyaltyAccount extends Document {
    userId: mongoose.Types.ObjectId;
    clerkId: string;
    points: number;
    totalEarned: number;
    totalRedeemed: number;
    tier: 'bronze' | 'silver' | 'gold';
    history: ILoyaltyTransaction[];
    createdAt: Date;
    updatedAt: Date;
}

const LoyaltyTransactionSchema = new Schema({
    type: { type: String, enum: ['earned', 'redeemed', 'bonus', 'referral'], required: true },
    points: { type: Number, required: true },
    description: { type: String, required: true },
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    createdAt: { type: Date, default: Date.now },
});

const LoyaltyAccountSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
        clerkId: { type: String, required: true, unique: true },
        points: { type: Number, default: 0 },
        totalEarned: { type: Number, default: 0 },
        totalRedeemed: { type: Number, default: 0 },
        tier: { type: String, enum: ['bronze', 'silver', 'gold'], default: 'bronze' },
        history: [LoyaltyTransactionSchema],
    },
    { timestamps: true }
);

// Compute tier based on totalEarned
LoyaltyAccountSchema.pre('save', function (next) {
    if (this.totalEarned >= 1000) this.tier = 'gold';
    else if (this.totalEarned >= 500) this.tier = 'silver';
    else this.tier = 'bronze';
    next();
});

LoyaltyAccountSchema.index({ clerkId: 1 });
LoyaltyAccountSchema.index({ userId: 1 });

const LoyaltyAccount = mongoose.model<ILoyaltyAccount>('LoyaltyAccount', LoyaltyAccountSchema);
export default LoyaltyAccount;
