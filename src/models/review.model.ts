import mongoose, { Schema, Document } from 'mongoose';

export interface IReview extends Document {
    customerId: mongoose.Types.ObjectId;
    vendorServiceId: mongoose.Types.ObjectId;
    appointmentId: mongoose.Types.ObjectId;
    vendorId: mongoose.Types.ObjectId;
    rating: number;
    title?: string;
    comment?: string;
    images?: string[];
    status: 'pending' | 'approved' | 'rejected';
    isVerified: boolean;
    helpfulCount: number;
    reportCount: number;
    vendorResponse?: {
        comment: string;
        respondedAt: Date;
    };
    createdAt: Date;
    updatedAt: Date;
}

const ReviewSchema: Schema = new Schema({
    customerId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    vendorServiceId: {
        type: Schema.Types.ObjectId,
        ref: 'VendorService',
        required: true
    },
    appointmentId: {
        type: Schema.Types.ObjectId,
        ref: 'Appointment',
        required: true,
        unique: true // One review per appointment
    },
    vendorId: {
        type: Schema.Types.ObjectId,
        ref: 'Vendor',
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    title: {
        type: String,
        maxlength: 100
    },
    comment: {
        type: String,
        maxlength: 1000
    },
    images: [{
        type: String
    }],
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'approved' // Auto-approve by default, change to 'pending' if moderation needed
    },
    isVerified: {
        type: Boolean,
        default: true // Verified purchase since we check appointment
    },
    helpfulCount: {
        type: Number,
        default: 0
    },
    reportCount: {
        type: Number,
        default: 0
    },
    vendorResponse: {
        comment: String,
        respondedAt: Date
    }
}, {
    timestamps: true
});

// Indexes for performance optimization
ReviewSchema.index({ vendorServiceId: 1, status: 1 });
ReviewSchema.index({ vendorId: 1, status: 1 });
ReviewSchema.index({ customerId: 1 });
// Index for rating-based queries and sorting
ReviewSchema.index({ rating: -1 });
// Index for status filtering (moderation)
ReviewSchema.index({ status: 1 });
// Compound index for vendor service reviews with rating
ReviewSchema.index({ vendorServiceId: 1, rating: -1, createdAt: -1 });
// Index for recent reviews
ReviewSchema.index({ createdAt: -1 });
// Index for reported reviews (moderation)
ReviewSchema.index({ reportCount: -1 });

export default mongoose.model<IReview>('Review', ReviewSchema);
