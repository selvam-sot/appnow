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
    markAppointmentMissed,
    markAppointmentFailed,
    getVendorServices,
    getVendorServiceById,
    createVendorService,
    updateVendorService,
    deleteVendorService,
    toggleServiceStatus,
    getServiceSlots,
    createServiceSlot,
    updateServiceSlot,
    deleteServiceSlot,
    getEarnings,
    getTransactions,
    getProfile,
    updateProfile,
    getReviews,
    replyToReview,
    getReviewsForManagement,
    getRecentReviews,
    approveReview,
    rejectReview,
    getCategories,
    getSubCategories
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
router.post('/appointments/:id/missed', [
    body('reason').notEmpty().withMessage('Reason is required').isLength({ min: 5 }).withMessage('Reason must be at least 5 characters')
], markAppointmentMissed);
router.post('/appointments/:id/failed', [
    body('reason').notEmpty().withMessage('Reason is required').isLength({ min: 5 }).withMessage('Reason must be at least 5 characters')
], markAppointmentFailed);

// Categories (for service creation)
router.get('/categories', getCategories);
router.get('/categories/:categoryId/subcategories', getSubCategories);

// Services - CRUD
router.get('/services', getVendorServices);
router.get('/services/:id', getVendorServiceById);
router.post('/services', [
    body('name').notEmpty().withMessage('Service name is required'),
    body('categoryId').notEmpty().withMessage('Category is required'),
    body('price').isNumeric().withMessage('Price must be a number'),
    body('duration').isNumeric().withMessage('Duration must be a number')
], createVendorService);
router.put('/services/:id', updateVendorService);
router.delete('/services/:id', deleteVendorService);
router.patch('/services/:id/status', [
    body('isActive').isBoolean()
], toggleServiceStatus);

// Slots - CRUD for each service
router.get('/services/:serviceId/slots', getServiceSlots);
router.post('/services/:serviceId/slots', [
    body('date').notEmpty().withMessage('Date is required'),
    body('fromTime').notEmpty().withMessage('Start time is required'),
    body('toTime').notEmpty().withMessage('End time is required')
], createServiceSlot);
router.put('/services/:serviceId/slots/:slotId', updateServiceSlot);
router.delete('/services/:serviceId/slots/:slotId', deleteServiceSlot);

// Earnings
router.get('/earnings', getEarnings);
router.get('/transactions', getTransactions);

// Profile
router.get('/profile', getProfile);
router.put('/profile', updateProfile);

// Reviews
router.get('/reviews', getReviews);
router.get('/reviews/manage', getReviewsForManagement);
router.get('/reviews/recent', getRecentReviews);
router.post('/reviews/:id/reply', [
    body('reply').notEmpty().withMessage('Reply is required')
], replyToReview);
router.post('/reviews/:id/approve', approveReview);
router.post('/reviews/:id/reject', rejectReview);

export default router;
