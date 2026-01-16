import { Document, Types } from 'mongoose';

export interface IUserSettings extends Document {
    _id: string;
    userId: Types.ObjectId;
    clerkId?: string; // Alternative lookup by Clerk ID

    // Appearance
    darkMode: boolean;

    // Notifications
    enableNotifications: boolean;
    pushNotifications: boolean;
    emailNotifications: boolean;

    // Security
    biometricLogin: boolean;

    // Privacy
    usageAnalytics: boolean;

    // Timestamps
    createdAt: Date;
    updatedAt: Date;
}

export interface IUserSettingsInput {
    userId?: Types.ObjectId;
    clerkId?: string;
    darkMode?: boolean;
    enableNotifications?: boolean;
    pushNotifications?: boolean;
    emailNotifications?: boolean;
    biometricLogin?: boolean;
    usageAnalytics?: boolean;
}
