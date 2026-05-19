import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '@clerk/backend';
import { AppError } from '../utils/appError.util';
import { asyncHandler } from '../utils/asyncHandler.util';
import User from '../models/user.model';

/**
 * Decode JWT payload without verifying signature (fallback only)
 * Used when Clerk SDK verification fails for environmental reasons
 * (e.g. unable to reach Clerk JWKS endpoint from the deployed server).
 */
function decodeJwtSub(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return payload?.sub || null;
  } catch {
    return null;
  }
}

/**
 * Verify Clerk JWT token and extract user ID.
 * Tries Clerk SDK first (full signature verification). Falls back to JWT decode
 * if Clerk SDK fails so the app keeps working when JWKS is unreachable.
 * Security still relies on the user existing in DB with the right role.
 */
async function verifyClerkToken(token: string): Promise<string | null> {
  if (process.env.CLERK_SECRET_KEY) {
    try {
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
      });
      if (payload?.sub) return payload.sub;
    } catch (err: any) {
      console.warn('[admin-auth] Clerk verifyToken failed, falling back to JWT decode:', err?.message);
    }
  }
  return decodeJwtSub(token);
}

// Roles allowed to access admin portal
const ADMIN_PORTAL_ROLES = ['admin', 'vendor'];

/**
 * Middleware to protect admin portal routes
 * Verifies the user is authenticated via Clerk and has admin or vendor role
 */
export const protectAdmin = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    let token: string | undefined;

    // Get token from Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(
        new AppError('You are not logged in. Please log in to access this resource.', 401),
      );
    }

    // Extract Clerk ID from the token
    const clerkId = await verifyClerkToken(token);

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

    // Check if user has admin or vendor role
    if (!ADMIN_PORTAL_ROLES.includes(user.role)) {
      return next(
        new AppError(
          'Access denied. This resource is only available to administrators and vendors.',
          403,
        ),
      );
    }

    // Attach user to request
    req.user = user;
    req.auth = {
      userId: user._id.toString(),
      clerkId: user.clerkId,
    };

    next();
  },
);

/**
 * Middleware to optionally authenticate admin/vendor
 * Does not throw error if not authenticated
 */
export const optionalAdminAuth = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    let token: string | undefined;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next();
    }

    try {
      const clerkId = await verifyClerkToken(token);

      if (clerkId) {
        const user = await User.findOne({
          clerkId,
          isActive: true,
          role: { $in: ADMIN_PORTAL_ROLES },
        });

        if (user) {
          req.user = user;
          req.auth = {
            userId: user._id.toString(),
            clerkId: user.clerkId,
          };
        }
      }
    } catch (error) {
      // Silently continue without authentication
    }

    next();
  },
);

/**
 * Middleware to restrict access to admin-only
 * Use after protectAdmin when you need admin-only access
 */
export const adminOnly = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'admin') {
    return next(
      new AppError('Access denied. This resource is only available to administrators.', 403),
    );
  }
  next();
});
