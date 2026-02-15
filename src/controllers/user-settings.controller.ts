import { Request, Response } from 'express';
import UserSettings from '../models/user-settings.model';
import User from '../models/user.model';
import { AppError } from '../utils/appError.util';
import { asyncHandler } from '../utils/asyncHandler.util';

// Default settings for new users
const DEFAULT_SETTINGS = {
    darkMode: false,
    enableNotifications: true,
    pushNotifications: true,
    emailNotifications: true,
    biometricLogin: false,
    usageAnalytics: true
};

/**
 * Get user settings by Clerk ID
 * Creates default settings if none exist
 */
export const getUserSettings = asyncHandler(async (req: Request, res: Response) => {
    const { clerkId } = req.params;

    if (!clerkId) {
        throw new AppError('Clerk ID is required', 400);
    }

    // Try to find existing settings
    let settings = await UserSettings.findOne({ clerkId });

    // If no settings exist, create default settings
    if (!settings) {
        // First, check if user exists
        const user = await User.findOne({ clerkId });

        settings = await UserSettings.create({
            clerkId,
            userId: user?._id,
            ...DEFAULT_SETTINGS
        });
    }

    res.status(200).json({
        success: true,
        data: {
            id: settings._id,
            clerkId: settings.clerkId,
            darkMode: settings.darkMode,
            enableNotifications: settings.enableNotifications,
            pushNotifications: settings.pushNotifications,
            emailNotifications: settings.emailNotifications,
            biometricLogin: settings.biometricLogin,
            usageAnalytics: settings.usageAnalytics,
            updatedAt: settings.updatedAt
        }
    });
});

/**
 * Update user settings
 */
export const updateUserSettings = asyncHandler(async (req: Request, res: Response) => {
    const { clerkId } = req.params;
    const {
        darkMode,
        enableNotifications,
        pushNotifications,
        emailNotifications,
        biometricLogin,
        usageAnalytics
    } = req.body;

    if (!clerkId) {
        throw new AppError('Clerk ID is required', 400);
    }

    // Find or create settings
    let settings = await UserSettings.findOne({ clerkId });

    if (!settings) {
        // Get user if they exist
        const user = await User.findOne({ clerkId });

        settings = await UserSettings.create({
            clerkId,
            userId: user?._id,
            ...DEFAULT_SETTINGS
        });
    }

    // Update only the fields that were provided
    if (typeof darkMode === 'boolean') settings.darkMode = darkMode;
    if (typeof enableNotifications === 'boolean') settings.enableNotifications = enableNotifications;
    if (typeof pushNotifications === 'boolean') settings.pushNotifications = pushNotifications;
    if (typeof emailNotifications === 'boolean') settings.emailNotifications = emailNotifications;
    if (typeof biometricLogin === 'boolean') settings.biometricLogin = biometricLogin;
    if (typeof usageAnalytics === 'boolean') settings.usageAnalytics = usageAnalytics;

    await settings.save();

    res.status(200).json({
        success: true,
        message: 'Settings updated successfully',
        data: {
            id: settings._id,
            clerkId: settings.clerkId,
            darkMode: settings.darkMode,
            enableNotifications: settings.enableNotifications,
            pushNotifications: settings.pushNotifications,
            emailNotifications: settings.emailNotifications,
            biometricLogin: settings.biometricLogin,
            usageAnalytics: settings.usageAnalytics,
            updatedAt: settings.updatedAt
        }
    });
});

/**
 * Delete user settings (used when user account is deleted)
 */
export const deleteUserSettings = asyncHandler(async (req: Request, res: Response) => {
    const { clerkId } = req.params;

    if (!clerkId) {
        throw new AppError('Clerk ID is required', 400);
    }

    const result = await UserSettings.findOneAndDelete({ clerkId });

    if (!result) {
        // Not an error - settings might not exist
        res.status(200).json({
            success: true,
            message: 'No settings found to delete'
        });
        return;
    }

    res.status(200).json({
        success: true,
        message: 'Settings deleted successfully'
    });
});

/**
 * Update a single setting field
 * Useful for individual toggle changes
 */
export const updateSingleSetting = asyncHandler(async (req: Request, res: Response) => {
    const { clerkId, settingKey } = req.params;
    const { value } = req.body;

    if (!clerkId) {
        throw new AppError('Clerk ID is required', 400);
    }

    const allowedSettings = [
        'darkMode',
        'enableNotifications',
        'pushNotifications',
        'emailNotifications',
        'biometricLogin',
        'usageAnalytics'
    ];

    if (!allowedSettings.includes(settingKey)) {
        throw new AppError(`Invalid setting key: ${settingKey}`, 400);
    }

    if (typeof value !== 'boolean') {
        throw new AppError('Setting value must be a boolean', 400);
    }

    // Find or create settings
    let settings = await UserSettings.findOne({ clerkId });

    if (!settings) {
        const user = await User.findOne({ clerkId });
        settings = await UserSettings.create({
            clerkId,
            userId: user?._id,
            ...DEFAULT_SETTINGS
        });
    }

    // Update the specific setting
    (settings as any)[settingKey] = value;
    await settings.save();

    res.status(200).json({
        success: true,
        message: `${settingKey} updated successfully`,
        data: {
            [settingKey]: value,
            updatedAt: settings.updatedAt
        }
    });
});
