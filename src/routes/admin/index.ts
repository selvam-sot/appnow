import { Router } from 'express';
import { body } from 'express-validator';

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

const router = Router();

// Public routes - Admin sync (no authentication required for initial sync)
router.post('/sync', [
    body('clerkId').notEmpty().withMessage('Clerk ID is required'),
    body('email').isEmail().withMessage('Valid email is required')
], syncAdmin);

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
