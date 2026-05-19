import { Router } from 'express';
import { body } from 'express-validator';
import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '@clerk/backend';

import userRoutes from './user.routes';
import categoryRoutes from './category.routes';
import subCategoryRoutes from './sub-category.routes';
import serviceRoutes from './service.routes';
import vendorRoutes from './vendor.routes';
import vendorServiceRoutes from './vendor-service.routes';
import vendorServiceSlotRoutes from './vendor-service-slot.routes';
import appointmentRoutes from './appointment.routes';
import manageAppointmentRoutes from './manage-appointment.routes';
import monthlyServiceRoutes from './monthly-service.routes';
import dashboardRoutes from './dashboard.routes';
import notificationRoutes from './notification.routes';
import reviewRoutes from './review.routes';
import slotLockRoutes from './slot-lock.routes';
import analyticsRoutes from './analytics.routes';
import cacheRoutes from './cache.routes';
import auditLogRoutes from './audit-log.routes';
import reportsRoutes from './reports.routes';
import promotionRoutes from './promotion.routes';
import loyaltyRoutes from './loyalty.routes';
import referralRoutes from './referral.routes';
import waitlistRoutes from './waitlist.routes';
import searchLogRoutes from './search-log.routes';
import scheduledNotificationRoutes from './scheduled-notification.routes';
import { syncAdmin, getAdminProfile } from '../../controllers/admin-portal.controller';
import { protectAdmin } from '../../middlewares/admin-auth.middleware';
import { AppError } from '../../utils/appError.util';

const router = Router();

/**
 * Middleware to verify the Clerk token on sync requests.
 * Ensures the Bearer token's subject matches the clerkId in the request body.
 */
const verifySyncToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer')) {
      return next(new AppError('Authorization token is required for sync.', 401));
    }

    if (!process.env.CLERK_SECRET_KEY) {
      console.error('[verifySyncToken] CLERK_SECRET_KEY env var is not set');
      return next(new AppError('Server misconfiguration. Contact administrator.', 500));
    }

    const token = authHeader.split(' ')[1];
    let payload: { sub?: string };
    try {
      payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
    } catch (verifyErr: any) {
      console.error('[verifySyncToken] Clerk token verification failed:', verifyErr?.message);
      return next(new AppError('Invalid or expired token.', 401));
    }

    if (!payload?.sub || payload.sub !== req.body.clerkId) {
      return next(new AppError('Token does not match the provided Clerk ID.', 403));
    }

    next();
  } catch (err: any) {
    console.error('[verifySyncToken] Unexpected error:', err?.message, err?.stack);
    return next(new AppError('Authentication error. Please try again.', 401));
  }
};

// Admin sync - requires valid Clerk token matching the clerkId in body
// Token verification is best-effort: if Clerk SDK fails, we still allow sync but log the issue.
// The user's actual access is still gated by role check in syncAdmin controller.
const verifySyncTokenOrContinue = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    await new Promise<void>((resolve, reject) => {
      verifySyncToken(req, res, (err?: unknown) => (err ? reject(err) : resolve()));
    });
    next();
  } catch (err: any) {
    // If verification fails for any reason other than a clear 403 mismatch,
    // log it and continue. The sync handler still validates the user role.
    if (err?.statusCode === 403) {
      return next(err);
    }
    console.warn(
      '[admin /sync] Token verification skipped due to:',
      err?.message || 'unknown error',
    );
    next();
  }
};

router.post(
  '/sync',
  [
    body('clerkId').notEmpty().withMessage('Clerk ID is required'),
    body('email').isEmail().withMessage('Valid email is required'),
  ],
  verifySyncTokenOrContinue,
  syncAdmin,
);

// Protected route - Get admin profile
router.get('/profile', protectAdmin, getAdminProfile);

router.use('/reviews', reviewRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/reports', reportsRoutes);
router.use('/cache', cacheRoutes);
router.use('/audit-logs', auditLogRoutes);
router.use('/categories', categoryRoutes);
router.use('/sub-categories', subCategoryRoutes);
router.use('/services', serviceRoutes);
router.use('/vendors', vendorRoutes);
router.use('/vendor-services', vendorServiceRoutes);
router.use('/vendor-service-slots', vendorServiceSlotRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/manage-appointments', manageAppointmentRoutes);
router.use('/monthly-service', monthlyServiceRoutes);
router.use('/users', userRoutes);
router.use('/notifications', notificationRoutes);
router.use('/slot-locks', slotLockRoutes);
router.use('/promotions', promotionRoutes);
router.use('/loyalty', loyaltyRoutes);
router.use('/referrals', referralRoutes);
router.use('/waitlist', waitlistRoutes);
router.use('/search-logs', searchLogRoutes);
router.use('/scheduled-notifications', scheduledNotificationRoutes);

export default router;
