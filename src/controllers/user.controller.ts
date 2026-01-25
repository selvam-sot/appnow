import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import User from '../models/user.model';
import { AppError } from '../utils/appError.util';
import { asyncHandler } from '../utils/asyncHandler.util';
import crypto from 'crypto';
import { sendActivationEmail } from '../services/email.service';
import { signToken, verifyToken, setTokenCookie } from '../utils/jwt.util';

export const signupUser = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError('Validation Error', 400);
    }

    const { firstName, lastName, userName, email, password, role } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
        throw new AppError('User already exists', 400);
    }

    const activationToken = crypto.randomBytes(20).toString('hex');
    const user = await User.create({
        firstName,
        lastName,
        userName,
        email,
        password,
        role,
        activationToken,
        isActive: false
    });

    // Send activation email
    try {
        await sendActivationEmail(email, activationToken);
    } catch (emailError) {
        // Log email error but don't fail the signup
        console.error('Failed to send activation email:', emailError);
    }

    res.status(201).json({
        success: true,
        message: 'User created successfully. Please check your email to activate your account.'
    });
});

export const activateUser = asyncHandler(async (req: Request, res: Response) => {
    const { activationToken } = req.params;

    const user = await User.findOne({ activationToken });
    if (!user) {
        throw new AppError('Invalid activation token', 400);
    }

    user.isActive = true;
    user.activationToken = '';
    await user.save();

    res.json({ message: 'Account activated successfully. You can now log in.' });
});

export const loginUser = asyncHandler(async (req: Request, res: Response) => {
    const { userName, email, password } = req.body;

    // Support login by either userName or email
    const loginField = email || userName;
    const user = await User.findOne({
        $or: [{ email: loginField }, { userName: loginField }]
    }).select('+password');

    if (!user) {
        throw new AppError('Incorrect username or password', 401);
    }

    // Check if user is a Clerk user (no password required)
    if (user.authProvider === 'clerk') {
        throw new AppError('Please use OAuth login for this account', 401);
    }

    // For local users, password is required
    if (!user.password || !(await user.correctPassword(password, user.password))) {
        throw new AppError('Incorrect username or password', 401);
    }

    const token = signToken(user._id, user.role, user.tokenVersion);

    setTokenCookie(res, token);

    // Remove password from response
    user.password = undefined;

    res.status(200).json({
        success: true,
        token,
        user
    });
});

export const logoutUser = asyncHandler(async (req: Request, res: Response) => {
    // First, fetch the complete user from the database using the ID from req.user
    if (!req.user || !req.user.id) {
        throw new AppError('Not authenticated', 401);
    }
    
    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (!user) {
        throw new AppError('User not found', 404);
    }

    // Now we can call the method on the actual user document
    await user.incrementTokenVersion();

    // Use cookie options that align with our JWT utility
    res.clearCookie('jwt');

    res.status(200).json({ status: 'success', message: 'Logged out successfully' });
});

export const getUserProfile = asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findById(req.user!.id);
    if (!user) {
        throw new AppError('User not found', 404);
    }
    
    res.json({
        _id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.role,
    });
});

export const updateUserProfile = asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findById(req.user!.id);

    if (!user) {
        throw new AppError('User not found', 404);
    }

    user.firstName = req.body.firstName || user.firstName;
    user.lastName = req.body.lastName || user.lastName;
    user.email = req.body.email || user.email;
    if (req.body.password) {
        user.password = req.body.password;
    }

    const updatedUser = await user.save();

    res.json({
        _id: updatedUser._id,
        name: `${updatedUser.firstName} ${updatedUser.lastName}`,
        email: updatedUser.email,
        role: updatedUser.role,
    });
});

export const deleteUserAccount = asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findById(req.user!.id);
    if (!user) {
        throw new AppError('User not found', 404);
    }

    // Actually delete the user from database
    await User.findByIdAndDelete(req.user!.id);

    res.clearCookie('jwt');
    res.status(200).json({
        success: true,
        message: 'User account deleted successfully'
    });
});

export const getUsers = asyncHandler(async (req: Request, res: Response) => {
    // Sort by email which has a unique index (CosmosDB requires index for order-by)
    const users = await User.find({}).sort({ email: 1 });
    res.status(200).json({
        success: true,
        count: users.length,
        data: users,
    });
});

// ========== CLERK INTEGRATION FUNCTIONS ==========

export const syncClerkUser = asyncHandler(async (req: Request, res: Response) => {
    const { clerkId, email, firstName, lastName, fullName, imageUrl } = req.body;

    if (!clerkId || !email) {
        throw new AppError('Clerk ID and email are required', 400);
    }

    // Check if user already exists
    let user = await User.findOne({
        $or: [
            { clerkId: clerkId },
            { email: email }
        ]
    });

    if (user) {
        // Update existing user - always update clerkId to handle Clerk account changes
        user.clerkId = clerkId;
        user.authProvider = 'clerk';
        user.email = email;
        user.firstName = firstName || user.firstName;
        user.lastName = lastName || user.lastName;
        user.isActive = true;
        user.lastSyncedAt = new Date();

        await user.save();
    } else {
        // Create new user
        user = await User.create({
            clerkId,
            email,
            firstName: firstName || 'User',
            lastName: lastName || '',
            authProvider: 'clerk',
            role: 'customer',
            isActive: true,
            lastSyncedAt: new Date()
        });
    }
    res.status(200).json({
        success: true,
        message: 'User synced successfully',
        data: {
            id: user._id,
            clerkId: user.clerkId,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            fullName: user.fullName || `${user.firstName} ${user.lastName}`,
            role: user.role,
            authProvider: user.authProvider
        }
    });
});

export const getClerkUser = asyncHandler(async (req: Request, res: Response) => {
    const { clerkId } = req.params;
    
    const user = await User.findOne({ clerkId });
    
    if (!user) {
        throw new AppError('User not found', 404);
    }
    
    res.status(200).json({
        success: true,
        data: {
            id: user._id,
            clerkId: user.clerkId,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            fullName: user.fullName || `${user.firstName} ${user.lastName}`,
            role: user.role,
            authProvider: user.authProvider,
            isActive: user.isActive
        }
    });
});

export const updateClerkUser = asyncHandler(async (req: Request, res: Response) => {
    const { clerkId } = req.params;
    const { email, firstName, lastName, imageUrl } = req.body;
    
    const user = await User.findOne({ clerkId });
    
    if (!user) {
        throw new AppError('User not found', 404);
    }
    
    // Update user fields
    if (email) user.email = email;
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    user.lastSyncedAt = new Date();
    
    await user.save();
    
    res.status(200).json({
        success: true,
        message: 'User updated successfully',
        data: {
            id: user._id,
            clerkId: user.clerkId,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            fullName: `${user.firstName} ${user.lastName}`,
            role: user.role,
            authProvider: user.authProvider
        }
    });
});

export const deleteClerkUser = asyncHandler(async (req: Request, res: Response) => {
    const { clerkId } = req.params;

    const user = await User.findOneAndDelete({ clerkId });

    if (!user) {
        throw new AppError('User not found', 404);
    }

    res.status(200).json({
        success: true,
        message: 'User deleted successfully'
    });
});

// ========== ADMIN USER MANAGEMENT ==========

/**
 * Search and filter users with pagination
 */
export const searchUsers = asyncHandler(async (req: Request, res: Response) => {
    const {
        page = 1,
        limit = 20,
        search,
        role,
        isActive,
        authProvider,
        sortBy = 'createdAt',
        sortOrder = 'desc'
    } = req.query;

    // Build query
    const query: any = {};

    // Text search across name and email
    if (search) {
        const searchRegex = new RegExp(search as string, 'i');
        query.$or = [
            { firstName: searchRegex },
            { lastName: searchRegex },
            { email: searchRegex },
            { userName: searchRegex }
        ];
    }

    // Filter by role
    if (role) {
        query.role = role;
    }

    // Filter by active status
    if (isActive !== undefined) {
        query.isActive = isActive === 'true';
    }

    // Filter by auth provider
    if (authProvider) {
        query.authProvider = authProvider;
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const skip = (pageNum - 1) * limitNum;

    // Build sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with pagination
    const [users, total] = await Promise.all([
        User.find(query)
            .select('-password -activationToken -tokenVersion')
            .sort(sort)
            .skip(skip)
            .limit(limitNum)
            .lean(),
        User.countDocuments(query)
    ]);

    res.status(200).json({
        success: true,
        data: {
            users,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum)
            }
        }
    });
});

/**
 * Get user by ID (admin)
 */
export const getUserById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const user = await User.findById(id)
        .select('-password -activationToken -tokenVersion')
        .lean();

    if (!user) {
        throw new AppError('User not found', 404);
    }

    // Get user's appointment history summary
    const Appointment = require('../models/appointment.model').default;
    const appointmentStats = await Appointment.aggregate([
        { $match: { customerId: user._id } },
        {
            $group: {
                _id: null,
                totalAppointments: { $sum: 1 },
                completedAppointments: {
                    $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                },
                cancelledAppointments: {
                    $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
                },
                totalSpent: {
                    $sum: {
                        $cond: [
                            { $eq: ['$paymentStatus', 'completed'] },
                            { $ifNull: ['$total', '$serviceFee'] },
                            0
                        ]
                    }
                }
            }
        }
    ]);

    res.status(200).json({
        success: true,
        data: {
            user,
            stats: appointmentStats[0] || {
                totalAppointments: 0,
                completedAppointments: 0,
                cancelledAppointments: 0,
                totalSpent: 0
            }
        }
    });
});

/**
 * Update user by ID (admin)
 */
export const updateUserById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { firstName, lastName, email, role, isActive, phone } = req.body;

    const user = await User.findById(id);

    if (!user) {
        throw new AppError('User not found', 404);
    }

    // Update fields
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (email !== undefined) user.email = email;
    if (role !== undefined) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    if (phone !== undefined) user.phone = phone;

    await user.save();

    res.status(200).json({
        success: true,
        message: 'User updated successfully',
        data: {
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            phone: user.phone
        }
    });
});

/**
 * Deactivate user (admin)
 */
export const deactivateUser = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
        throw new AppError('User not found', 404);
    }

    // Prevent deactivating self
    if (user._id.toString() === req.user!.id) {
        throw new AppError('Cannot deactivate your own account', 400);
    }

    user.isActive = false;
    await user.incrementTokenVersion(); // Invalidate all existing tokens
    await user.save();

    res.status(200).json({
        success: true,
        message: 'User deactivated successfully'
    });
});

/**
 * Reactivate user (admin)
 */
export const reactivateUser = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
        throw new AppError('User not found', 404);
    }

    user.isActive = true;
    await user.save();

    res.status(200).json({
        success: true,
        message: 'User reactivated successfully'
    });
});

/**
 * Delete user by ID (admin)
 */
export const deleteUserById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
        throw new AppError('User not found', 404);
    }

    // Prevent deleting self
    if (user._id.toString() === req.user!.id) {
        throw new AppError('Cannot delete your own account', 400);
    }

    // Prevent deleting other admins
    if (user.role === 'admin') {
        throw new AppError('Cannot delete admin users from this endpoint', 400);
    }

    await User.findByIdAndDelete(id);

    res.status(200).json({
        success: true,
        message: 'User deleted successfully'
    });
});

/**
 * Bulk deactivate users (admin)
 */
export const bulkDeactivateUsers = asyncHandler(async (req: Request, res: Response) => {
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
        throw new AppError('User IDs array is required', 400);
    }

    // Filter out current admin user
    const filteredIds = userIds.filter((id: string) => id !== req.user!.id);

    const result = await User.updateMany(
        {
            _id: { $in: filteredIds },
            role: { $ne: 'admin' } // Don't deactivate other admins
        },
        { isActive: false }
    );

    res.status(200).json({
        success: true,
        message: `${result.modifiedCount} users deactivated successfully`
    });
});

/**
 * Bulk activate users (admin)
 */
export const bulkActivateUsers = asyncHandler(async (req: Request, res: Response) => {
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
        throw new AppError('User IDs array is required', 400);
    }

    const result = await User.updateMany(
        { _id: { $in: userIds } },
        { isActive: true }
    );

    res.status(200).json({
        success: true,
        message: `${result.modifiedCount} users activated successfully`
    });
});

/**
 * Reset user password (admin)
 */
export const resetUserPassword = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
        throw new AppError('New password must be at least 8 characters', 400);
    }

    const user = await User.findById(id);

    if (!user) {
        throw new AppError('User not found', 404);
    }

    // Only allow password reset for local users
    if (user.authProvider === 'clerk') {
        throw new AppError('Cannot reset password for OAuth users', 400);
    }

    user.password = newPassword;
    await user.incrementTokenVersion(); // Invalidate all existing tokens
    await user.save();

    res.status(200).json({
        success: true,
        message: 'Password reset successfully'
    });
});