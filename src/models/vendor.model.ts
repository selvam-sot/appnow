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
    }
}, { 
    // Match the exact field names and structure from the database
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    },
    versionKey: '__v' // This matches the field in your DB output
});

export default mongoose.model<IVendor & Document>('Vendor', VendorSchema);