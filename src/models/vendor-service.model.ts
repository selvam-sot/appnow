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

VendorServiceSchema.index({ name: 1 });

export default mongoose.model<IVendorService & Document>('VendorService', VendorServiceSchema);