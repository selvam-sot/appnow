import express from 'express';
import {
    createReview,
    getVendorServiceReviews,
    getVendorReviews,
    getUserReviews,
    updateReview,
    deleteReview,
    canReviewAppointment
} from '../controllers/review.controller';

const router = express.Router();

// Public routes
router.get('/vendor-service/:vendorServiceId', getVendorServiceReviews);
router.get('/vendor/:vendorId', getVendorReviews);
router.get('/user/:customerId', getUserReviews);
router.get('/can-review/:appointmentId', canReviewAppointment);

// Protected routes (requires authentication)
router.post('/', createReview);
router.put('/:id', updateReview);
router.delete('/:id', deleteReview);

export default router;
