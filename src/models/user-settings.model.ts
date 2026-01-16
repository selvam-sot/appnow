import mongoose, { Schema } from 'mongoose';
import { IUserSettings } from '../interfaces/user-settings.interface';

const UserSettingsSchema: Schema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        sparse: true // Allow null values but ensure uniqueness when present
    },
    clerkId: {
        type: String,
        unique: true,
        sparse: true // Allow null values but ensure uniqueness when present
    },

    // Appearance
    darkMode: {
        type: Boolean,
        default: false
    },

    // Notifications
    enableNotifications: {
        type: Boolean,
        default: true
    },
    pushNotifications: {
        type: Boolean,
        default: true
    },
    emailNotifications: {
        type: Boolean,
        default: true
    },

    // Security
    biometricLogin: {
        type: Boolean,
        default: false
    },

    // Privacy
    usageAnalytics: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    },
    versionKey: '__v',
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Create compound index for faster lookups
UserSettingsSchema.index({ userId: 1 }, { unique: true, sparse: true });
UserSettingsSchema.index({ clerkId: 1 }, { unique: true, sparse: true });

export default mongoose.model<IUserSettings>('UserSettings', UserSettingsSchema);
