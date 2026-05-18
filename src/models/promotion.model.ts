import mongoose, { Schema } from 'mongoose';
import type { IPromotion } from '../interfaces/promotion.interface';

const PromotionSchema: Schema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subtitle: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    discount: {
      type: String,
      required: true,
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'percentage',
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    minBookingValue: {
      type: Number,
      default: 0,
    },
    maxDiscountAmount: {
      type: Number,
      default: null,
    },
    validFrom: {
      type: Date,
      required: true,
    },
    validUntil: {
      type: Date,
      required: true,
    },
    terms: [
      {
        type: String,
      },
    ],
    gradient: [
      {
        type: String,
      },
    ],
    icon: {
      type: String,
      default: 'gift-outline',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isNew: {
      type: Boolean,
      default: false,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    showInBanner: {
      type: Boolean,
      default: false,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    usageLimit: {
      type: Number,
      default: null,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    applicableServices: [
      {
        type: Schema.Types.ObjectId,
        ref: 'VendorService',
      },
    ],
    applicableCategories: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Category',
      },
    ],
    // Scope: 'platform' = available on all services (admin created)
    //        'vendor' = limited to a specific vendor's services (vendor or admin created)
    scope: {
      type: String,
      enum: ['platform', 'vendor'],
      default: 'platform',
    },
    // For vendor-scoped coupons, the vendor that created/owns the coupon
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      default: null,
    },
    // Who created the coupon - useful for vendor app filtering
    createdBy: {
      type: String,
      enum: ['admin', 'vendor'],
      default: 'admin',
    },
  },
  {
    timestamps: {
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    },
    versionKey: '__v',
  },
);

// Create indexes
PromotionSchema.index({ code: 1 });
PromotionSchema.index({ isActive: 1 });
PromotionSchema.index({ showInBanner: 1 });
PromotionSchema.index({ isFeatured: 1 });
PromotionSchema.index({ displayOrder: 1 });
PromotionSchema.index({ validFrom: 1, validUntil: 1 });
PromotionSchema.index({ scope: 1, vendorId: 1, isActive: 1 });
PromotionSchema.index({ applicableServices: 1, isActive: 1 });

export default mongoose.model<IPromotion>('Promotion', PromotionSchema, 'promotions');
