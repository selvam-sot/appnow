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

    const token = authHeader.split(' ')[1];
    const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY! });
    const sub = payload.sub;

    if (!sub || sub !== req.body.clerkId) {
      return next(new AppError('Token does not match the provided Clerk ID.', 403));
    }

    next();
  } catch {
    return next(new AppError('Invalid or expired token.', 401));
  }
};

// Admin sync - requires valid Clerk token matching the clerkId in body
router.post(
  '/sync',
  [
    body('clerkId').notEmpty().withMessage('Clerk ID is required'),
    body('email').isEmail().withMessage('Valid email is required'),
  ],
  verifySyncToken,
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
