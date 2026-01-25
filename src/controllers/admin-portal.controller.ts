import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.util';
import { AppError } from '../utils/appError.util';
import User from '../models/user.model';

/**
 * Sync admin user from Clerk
 * Creates or updates admin user record
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
        // Verify user has admin role
        if (user.role !== 'admin') {
            throw new AppError('Access denied. This account is not authorized for admin access.', 403);
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
        // For security, don't auto-create admin users
        // Admins must be pre-created in the database with role='admin'
        throw new AppError('Admin account not found. Please contact system administrator.', 404);
    }

    res.status(200).json({
        success: true,
        data: {
            id: user._id,
            clerkId: user.clerkId,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role
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
