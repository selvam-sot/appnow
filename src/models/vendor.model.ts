import type { Document } from 'mongoose';
import mongoose, { Schema } from 'mongoose';
import type { IVendor } from './../interfaces/vendor.interface';

const SocialMediaLinkSchema: Schema = new Schema({
  mediaName: {
    type: String,
  },
  mediaLink: {
    type: String,
  },
});

const VendorSchema: Schema = new Schema(
  {
    vendorName: {
      type: String,
      required: true,
    },
    serviceProviderName: {
      type: String,
    },
    aboutDescription: {
      type: String,
    },
    country: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    zip: {
      type: String,
      required: true,
    },
    address1: {
      type: String,
      required: true,
    },
    address2: {
      type: String,
    },
    location: {
      type: String,
    },
    // GeoJSON Point for "near me" search. Format: { type: 'Point', coordinates: [lng, lat] }
    geoLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: undefined,
      },
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
      type: [String],
    },
    image: {
      type: String,
      default: 'vendor.png',
    },
    specialists: {
      type: [String],
    },
    amenities: {
      type: [String],
    },
    tags: {
      type: [String],
    },
    socialMediaLinks: {
      type: [SocialMediaLinkSchema],
      required: false,
      default: [],
    },
    rating: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isFavorite: {
      type: Boolean,
      default: false,
    },
    isFreelancer: {
      type: Boolean,
      default: false,
    },
    // Verification fields
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
    },
    verificationNotes: {
      type: String,
    },
    verifiedAt: {
      type: Date,
    },
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    // Business documents (KYC beyond Stripe Connect — license + insurance)
    businessLicense: {
      type: String,
    },
    taxId: {
      type: String,
    },
    // Uploaded compliance documents. Client uploads to storage separately
    // and posts the URL + type here; admin reviews and sets status.
    businessDocuments: [
      {
        docType: {
          type: String,
          enum: [
            'business_license',
            'insurance_certificate',
            'w9_form',
            'professional_license',
            'other',
          ],
          required: true,
        },
        url: { type: String, required: true },
        status: {
          type: String,
          enum: ['pending_review', 'approved', 'rejected'],
          default: 'pending_review',
        },
        reviewNotes: { type: String },
        reviewedAt: { type: Date },
        reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    // ─── Stripe Connect (for vendor payouts) ───
    // Stripe Connect account ID (acct_xxx) — issued when vendor starts onboarding
    stripeConnectAccountId: {
      type: String,
      default: null,
      index: true,
    },
    // Has the vendor finished Stripe's KYC + bank account setup?
    stripeOnboardingCompleted: {
      type: Boolean,
      default: false,
    },
    // Stripe Connect flags from /accounts retrieve
    stripeChargesEnabled: {
      type: Boolean,
      default: false,
    },
    stripePayoutsEnabled: {
      type: Boolean,
      default: false,
    },
    // Country code for Stripe Connect (US for now)
    stripeCountry: {
      type: String,
      default: 'US',
    },
    // Platform commission percentage (0-100) — e.g. 10 = platform takes 10%
    commissionRate: {
      type: Number,
      default: 10,
      min: 0,
      max: 100,
    },
    // Reference to User record (for vendor login)
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      unique: true,
      sparse: true,
    },
    // Review stats
    totalReviews: {
      type: Number,
      default: 0,
    },
  },
  {
    // Match the exact field names and structure from the database
    timestamps: {
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    },
    versionKey: '__v', // This matches the field in your DB output
  },
);

// Indexes for performance optimization
// Index for vendor name search
VendorSchema.index({ vendorName: 1 });
// 2dsphere index for geo-search ($near, $geoWithin)
VendorSchema.index({ geoLocation: '2dsphere' });
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
// Index for user lookup (vendor login)
VendorSchema.index({ userId: 1 });
// Text index for search
VendorSchema.index({ vendorName: 'text', serviceProviderName: 'text', tags: 'text' });

export default mongoose.model<IVendor & Document>('Vendor', VendorSchema);
