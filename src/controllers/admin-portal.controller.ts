import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.util';
import { AppError } from '../utils/appError.util';
import User from '../models/user.model';
import Vendor from '../models/vendor.model';

/**
 * Sync admin/vendor user from Clerk
 * Creates or updates user record for admin portal access
 * Allows both 'admin' and 'vendor' roles
 */
export const syncAdmin = asyncHandler(async (req: Request, res: Response) => {
    const { clerkId, email, firstName, lastName } = req.body;

    if (!clerkId || !email) {
        throw new AppError('Clerk ID and email are required', 400);
    }

    // Find or create user
    let user = await User.findOne({
        $or: [
            { clerkId: clerkId },
            { email: email }
        ]
    });

    if (user) {
        // Verify user has admin or vendor role
        const allowedRoles = ['admin', 'vendor'];
        if (!allowedRoles.includes(user.role)) {
            throw new AppError('Access denied. This account is not authorized for admin portal access.', 403);
        }

        // Update existing user
        user.clerkId = clerkId;
        user.authProvider = 'clerk';
        user.email = email;
        user.firstName = firstName || user.firstName;
        user.lastName = lastName || user.lastName;
        user.isActive = true;
        user.lastSyncedAt = new Date();
        await user.save();
    } else {
        // For security, don't auto-create admin/vendor users
        // Users must be pre-created in the database with role='admin' or 'vendor'
        throw new AppError('Account not found. Please contact system administrator.', 404);
    }

    // For vendor users, fetch the associated vendor record
    let vendorId = null;
    if (user.role === 'vendor') {
        const vendor = await Vendor.findOne({ userId: user._id });
        if (vendor) {
            vendorId = vendor._id;
        }
    }

    res.status(200).json({
        success: true,
        data: {
            id: user._id,
            clerkId: user.clerkId,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            vendorId: vendorId
        }
    });
});

/**
 * Get current admin profile
 */
export const getAdminProfile = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user;

    if (!user) {
        throw new AppError('Not authenticated', 401);
    }

    res.status(200).json({
        success: true,
        data: {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            avatar: user.avatar
        }
    });
});
