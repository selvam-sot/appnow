import { Router } from 'express';
import { body } from 'express-validator';
import {
    syncVendor,
    getDashboardStats,
    getTodayAppointments,
    getAppointments,
    confirmAppointment,
    declineAppointment,
    completeAppointment,
    getVendorServices,
    toggleServiceStatus,
    getEarnings,
    getTransactions,
    getProfile,
    updateProfile,
    getReviews,
    replyToReview
} from '../../controllers/vendor-portal.controller';
import { protectVendor } from '../../middlewares/vendor-auth.middleware';

const router = Router();

// Public routes (no authentication required)
router.post('/sync', [
    body('clerkId').notEmpty().withMessage('Clerk ID is required'),
    body('email').isEmail().withMessage('Valid email is required')
], syncVendor);

// All routes below require vendor authentication
router.use(protectVendor);

// Dashboard
router.get('/dashboard/stats', getDashboardStats);
router.get('/appointments/today', getTodayAppointments);

// Appointments
router.get('/appointments', getAppointments);
router.post('/appointments/:id/confirm', confirmAppointment);
router.post('/appointments/:id/decline', [
    body('reason').optional().isString()
], declineAppointment);
router.post('/appointments/:id/complete', completeAppointment);

// Services
router.get('/services', getVendorServices);
router.patch('/services/:id/status', [
    body('isActive').isBoolean()
], toggleServiceStatus);

// Earnings
router.get('/earnings', getEarnings);
router.get('/transactions', getTransactions);

// Profile
router.get('/profile', getProfile);
router.put('/profile', updateProfile);

// Reviews
router.get('/reviews', getReviews);
router.post('/reviews/:id/reply', [
    body('reply').notEmpty().withMessage('Reply is required')
], replyToReview);

export default router;
