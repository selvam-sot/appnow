import mongoose, { Schema, Document } from 'mongoose';
import { IVendor } from './../interfaces/vendor.interface';

const SocialMediaLinkSchema: Schema = new Schema({
    mediaName: {
        type: String
    },
    mediaLink: {
        type: String
    }
});

const VendorSchema: Schema = new Schema({
    vendorName: {
        type: String,
        required: true
    },
    serviceProviderName: {
        type: String,
    },
    aboutDescription: {
        type: String,
    },
    country: {
        type: String,
        required: true
    },
    state: {
        type: String,
        required: true
    },
    city: {
        type: String,
        required: true
    },
    zip: {
        type: String,
        required: true
    },
    address1: {
        type: String,
        required: true
    },
    address2: {
        type: String
    },
    location: {
        type: String
    },
    email: {
        type: String,
    },
    phone: {
        type: String,
    },
    website: {
        type: String,
    },
    images: {
        type: [String]
    },
    image: {
        type: String,
        default:'vendor.png'
    },
    specialists: {
        type: [String]
    },
    amenities: {
        type: [String]
    },
    tags: {
        type: [String]
    },
    socialMediaLinks: {
        type: [SocialMediaLinkSchema],
        required: false,
        default: []
    },
    rating: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isFavorite: {
        type: Boolean,
        default: false
    },
    isFreelancer: {
        type: Boolean,
        default: false
    },
    // Verification fields
    verificationStatus: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending'
    },
    verificationNotes: {
        type: String
    },
    verifiedAt: {
        type: Date
    },
    verifiedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    // Business documents
    businessLicense: {
        type: String
    },
    taxId: {
        type: String
    }
}, {
    // Match the exact field names and structure from the database
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    },
    versionKey: '__v' // This matches the field in your DB output
});

// Indexes for performance optimization
// Index for vendor name search
VendorSchema.index({ vendorName: 1 });
// Index for location-based queries
VendorSchema.index({ city: 1 });
VendorSchema.index({ state: 1 });
VendorSchema.index({ country: 1 });
// Compound index for location search
VendorSchema.index({ country: 1, state: 1, city: 1 });
// Index for active vendors
VendorSchema.index({ isActive: 1 });
// Index for verification status
VendorSchema.index({ verificationStatus: 1 });
// Index for rating-based sorting
VendorSchema.index({ rating: -1 });
// Compound index for verified active vendors
VendorSchema.index({ verificationStatus: 1, isActive: 1 });
// Text index for search
VendorSchema.index({ vendorName: 'text', serviceProviderName: 'text', tags: 'text' });

export default mongoose.model<IVendor & Document>('Vendor', VendorSchema);