import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/appError.util';
import { asyncHandler } from '../utils/asyncHandler.util';
import User from '../models/user.model';
import Vendor from '../models/vendor.model';

// Extend Express Request to include vendor and auth
declare global {
    namespace Express {
        interface Request {
            vendor?: any;
            vendorId?: string;
            auth?: {
                userId?: string;
                clerkId?: string;
            };
        }
    }
}

/**
 * Extract Clerk user ID from JWT token
 * Clerk JWTs have the user ID as the 'sub' claim
 */
function extractClerkIdFromToken(token: string): string | null {
    try {
        // JWT has 3 parts: header.payload.signature
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        // Decode the payload (second part)
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));

        // Clerk puts user ID in 'sub' claim
        return payload.sub || null;
    } catch (error) {
        return null;
    }
}

/**
 * Middleware to protect vendor routes
 * Verifies the user is authenticated and is a vendor
 */
export const protectVendor = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    let token: string | undefined;

    // Get token from Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return next(new AppError('You are not logged in. Please log in to access this resource.', 401));
    }

    // Extract Clerk ID from the token
    const clerkId = extractClerkIdFromToken(token);

    if (!clerkId) {
        return next(new AppError('Invalid token format. Please log in again.', 401));
    }

    // Find user by Clerk ID
    const user = await User.findOne({ clerkId });

    if (!user) {
        return next(new AppError('User not found. Please sync your account first.', 401));
    }

    if (!user.isActive) {
        return next(new AppError('Your account has been deactivated. Please contact support.', 403));
    }

    // Check if user has vendor role
    if (user.role !== 'vendor') {
        return next(new AppError('Access denied. This resource is only available to vendors.', 403));
    }

    // Find the vendor profile associated with this user
    // Vendors are linked by email
    const vendor = await Vendor.findOne({ email: user.email });

    if (!vendor) {
        return next(new AppError('Vendor profile not found. Please complete your vendor registration.', 404));
    }

    if (!vendor.isActive) {
        return next(new AppError('Your vendor account is inactive. Please contact support.', 403));
    }

    // Check verification status
    if (vendor.verificationStatus === 'rejected') {
        return next(new AppError('Your vendor application has been rejected. Please contact support.', 403));
    }

    // Attach user and vendor to request
    req.user = user;
    req.vendor = vendor;
    req.vendorId = vendor._id.toString();
    req.auth = {
        userId: user._id.toString(),
        clerkId: user.clerkId
    };

    next();
});

/**
 * Middleware to optionally authenticate vendor
 * Does not throw error if not authenticated
 */
export const optionalVendorAuth = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    let token: string | undefined;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return next();
    }

    try {
        const clerkId = extractClerkIdFromToken(token);

        if (clerkId) {
            const user = await User.findOne({ clerkId, isActive: true, role: 'vendor' });

            if (user) {
                const vendor = await Vendor.findOne({ email: user.email, isActive: true });

                if (vendor) {
                    req.user = user;
                    req.vendor = vendor;
                    req.vendorId = vendor._id.toString();
                    req.auth = {
                        userId: user._id.toString(),
                        clerkId: user.clerkId
                    };
                }
            }
        }
    } catch (error) {
        // Silently continue without authentication
    }

    next();
});

/**
 * Middleware to check if vendor is verified
 * Use after protectVendor middleware
 */
export const requireVerifiedVendor = (req: Request, res: Response, next: NextFunction) => {
    if (!req.vendor) {
        return next(new AppError('Vendor authentication required.', 401));
    }

    if (req.vendor.verificationStatus !== 'verified') {
        return next(new AppError('Your vendor account is pending verification. Some features are restricted.', 403));
    }

    next();
};
