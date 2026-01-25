import mongoose, { Schema, Document } from 'mongoose';

export interface ISlotLock {
    vendorServiceId: mongoose.Types.ObjectId;
    date: Date;
    fromTime: string;
    toTime: string;
    lockedBy: mongoose.Types.ObjectId;
    paymentIntentId?: string;
    lockedAt: Date;
    expiresAt: Date;
}

export interface ISlotLockDocument extends ISlotLock, Document {}

const SlotLockSchema: Schema = new Schema({
    vendorServiceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'VendorService',
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    fromTime: {
        type: String,
        required: true
    },
    toTime: {
        type: String,
        required: true
    },
    lockedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    paymentIntentId: {
        type: String
    },
    lockedAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 0 } // TTL index - document deleted when expiresAt is reached
    }
}, {
    timestamps: false
});

// Compound index for efficient lookup
SlotLockSchema.index({ vendorServiceId: 1, date: 1, fromTime: 1, toTime: 1 }, { unique: true });
SlotLockSchema.index({ lockedBy: 1 });
SlotLockSchema.index({ paymentIntentId: 1 });

export default mongoose.model<ISlotLockDocument>('SlotLock', SlotLockSchema);
