import mongoose, { Schema, Document } from 'mongoose';
import { IVendorService } from './../interfaces/vendor-service.interface';

const SocialMediaLinkSchema: Schema = new Schema({
    mediaName: {
        type: String
    },
    mediaLink: {
        type: String
    }
});

const DescriptionSchema: Schema = new Schema({
    title: {
        type: String
    },
    type: {
        type: String
    },
    content: {
        type: [String]
    }
});


const VendorServiceSchema: Schema = new Schema({
    categoryId: {
        type: Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    subCategoryId: {
        type: Schema.Types.ObjectId,
        ref: 'SubCategory',
        required: true
    },
    serviceId: {
        type: Schema.Types.ObjectId,
        ref: 'Service',
        required: true
    },
    vendorId: {
        type: Schema.Types.ObjectId,
        ref: 'Vendor',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    subTitle: {
        type: String,
        required: true
    },
    shortDescriptionType: {
        type: String,
        required: true
    },
    shortDescription: {
        type: [String],
        required: true
    },
    description: {
        type: [DescriptionSchema],
        required: true
    },
    images: {
        type: [String]
    },
    image: {
        type: String,
        default:'service.png'
    },
    price: {
        type: Number,
        required: true
    },
    duration: {
        type: Number,
        required: true
    },
    servicePlace: {
        type: String,
        default: 'vendor'
    },
    serviceType: {
        type: String,
        default: 'In Person'
    },
    serviceTypeLink: {
        type: String,
    },
    isCombo: {
        type: Boolean,
        default: false
    },
    comboServiceIds: [
        {
            type: mongoose.Schema.Types.ObjectId,
            required: false
        }
    ],
    isActive: {
        type: Boolean,
        default: true
    },
    tags: {
        type: [String]
    },
    socialMediaLinks: {
        type: [SocialMediaLinkSchema],
        required: false,
        default: []
    },
}, { 
    // Match the exact field names and structure from the database
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    },
    versionKey: '__v' // This matches the field in your DB output
});

// Indexes for performance optimization
VendorServiceSchema.index({ name: 1 });
VendorServiceSchema.index({ serviceId: 1 });
// Index for vendor's services lookup
VendorServiceSchema.index({ vendorId: 1 });
// Index for category browsing
VendorServiceSchema.index({ categoryId: 1 });
// Index for subcategory browsing
VendorServiceSchema.index({ subCategoryId: 1 });
// Index for active services filtering
VendorServiceSchema.index({ isActive: 1 });
// Compound index for category + subcategory + active
VendorServiceSchema.index({ categoryId: 1, subCategoryId: 1, isActive: 1 });
// Index for price range queries
VendorServiceSchema.index({ price: 1 });
// Index for service place filtering
VendorServiceSchema.index({ servicePlace: 1 });
// Text index for search
VendorServiceSchema.index({ name: 'text', subTitle: 'text', tags: 'text' });

export default mongoose.model<IVendorService & Document>('VendorService', VendorServiceSchema);