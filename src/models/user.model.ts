import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import type { IUser } from './../interfaces/user.interface';

const UserSchema: Schema = new Schema(
  {
    firstName: {
      type: String,
    },
    lastName: {
      type: String,
    },
    userName: {
      type: String,
      required: function (this: IUser): boolean {
        // Only required if not a Clerk user
        return !this.clerkId;
      },
      unique: true,
      sparse: true, // Allow null values but ensure uniqueness when present
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: function (this: IUser): boolean {
        // Only required if not a Clerk user (traditional signup)
        return !this.clerkId;
      },
      private: true,
    },

    // NEW: Clerk Integration Fields
    clerkId: {
      type: String,
      unique: true,
      sparse: true, // Allow null values but ensure uniqueness when present
    },
    authProvider: {
      type: String,
      enum: ['local', 'clerk'],
      default: 'local',
    },
    lastSyncedAt: {
      type: Date,
      default: Date.now,
    },
    avatar: {
      type: String,
      default: 'avatar.png',
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    activationToken: {
      type: String,
    },
    role: {
      type: String,
      enum: ['customer', 'admin', 'vendor'],
      default: 'customer', // Changed from 'user' to 'customer' to match your enum
    },
    // Admin sub-role hierarchy (only relevant when role === 'admin').
    // super_admin: full access including destructive/financial actions.
    // support_agent: read + safe support actions (impersonation with reason,
    //                wallet credit up to a per-day cap enforced by policy).
    adminRole: {
      type: String,
      enum: ['super_admin', 'support_agent', null],
      default: null,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    passwordChangedAt: Date,
    // Push notification token (Expo Push Token)
    expoPushToken: {
      type: String,
      sparse: true,
    },
    stripeCustomerId: {
      type: String,
      sparse: true,
      index: true,
    },
    // ─── Phone & SMS consent (TCPA compliance) ───
    phone: {
      type: String,
      trim: true,
    },
    smsConsent: {
      type: Boolean,
      default: false,
    },
    smsConsentAt: {
      type: Date,
      default: null,
    },
    smsConsentMethod: {
      // How the user gave consent — for audit trail required by TCPA
      type: String,
      enum: ['signup_checkbox', 'profile_toggle', 'verbal', 'imported', null],
      default: null,
    },
    marketingEmailConsent: {
      type: Boolean,
      default: false,
    },
    marketingEmailConsentAt: {
      type: Date,
      default: null,
    },
    // ─── Wallet balance (store credit) ───
    // Running total in dollars. Sourced from WalletTransaction ledger.
    walletBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    // ─── Account deletion (CCPA / privacy) ───
    // Soft-delete: when set, the user can no longer log in and PII is scrubbed
    deletedAt: {
      type: Date,
      default: null,
    },
    deletionRequestedAt: {
      type: Date,
      default: null,
    },
    // ─── Saved addresses (Address Book) ───
    addresses: [
      {
        label: { type: String, trim: true }, // e.g. "Home", "Office"
        address1: { type: String, trim: true, required: true },
        address2: { type: String, trim: true },
        city: { type: String, trim: true, required: true },
        state: { type: String, trim: true, required: true },
        zip: { type: String, trim: true, required: true },
        country: { type: String, trim: true, default: 'US' },
        // GeoJSON point for "current location" + "nearest vendor" features
        location: {
          type: { type: String, enum: ['Point'], default: 'Point' },
          coordinates: { type: [Number], default: undefined },
        },
        isDefault: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    // ─── Notification preferences (per-type granular toggles) ───
    notificationPrefs: {
      // Push
      pushBookingUpdates: { type: Boolean, default: true },
      pushReminders: { type: Boolean, default: true },
      pushPromotions: { type: Boolean, default: false },
      // Email
      emailBookingUpdates: { type: Boolean, default: true },
      emailReminders: { type: Boolean, default: true },
      emailPromotions: { type: Boolean, default: false },
      // SMS — only sent if smsConsent === true (TCPA gate)
      smsBookingUpdates: { type: Boolean, default: true },
      smsReminders: { type: Boolean, default: true },
      smsPromotions: { type: Boolean, default: false },
    },
  },
  {
    // Match the exact field names and structure from the database
    timestamps: {
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    },
    versionKey: '__v', // This matches the field in your DB output
    toJSON: { virtuals: true }, // Include virtuals when converting to JSON
    toObject: { virtuals: true },
  },
);

// Virtual field for fullName
UserSchema.virtual('fullName').get(function (this: IUser) {
  return `${this.firstName} ${this.lastName}`.trim();
});

// Hash password before saving
UserSchema.pre('save', async function (this: IUser, next) {
  // Only hash the password if it has been modified (or is new) and exists
  if (!this.isModified('password') || !this.password) return next();

  // Hash the password with cost of 12
  this.password = await bcrypt.hash(this.password, 12);

  // Set passwordChangedAt to current time
  if (!this.isNew) {
    this.passwordChangedAt = new Date();
  }

  next();
});

UserSchema.methods.correctPassword = async function (
  candidatePassword: string,
  userPassword: string,
): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, userPassword);
};

UserSchema.methods.changedPasswordAfter = function (JWTTimestamp: number): boolean {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt((this.passwordChangedAt.getTime() / 1000).toString(), 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

UserSchema.methods.incrementTokenVersion = async function (): Promise<void> {
  this.tokenVersion += 1;
  await this.save();
};

// Additional indexes for performance optimization
// Index for role-based queries
UserSchema.index({ role: 1 });
// Index for active status filtering
UserSchema.index({ isActive: 1 });
// Compound index for admin user listing
UserSchema.index({ role: 1, createdAt: -1 });
// Index for push notification queries
UserSchema.index({ expoPushToken: 1 }, { sparse: true });
// Index for activation token lookup
UserSchema.index({ activationToken: 1 }, { sparse: true });
// Index for auth provider filtering
UserSchema.index({ authProvider: 1 });
// Sparse index for soft-deleted users (so login lookups can exclude them quickly)
UserSchema.index({ deletedAt: 1 }, { sparse: true });

export default mongoose.model<IUser>('User', UserSchema);
