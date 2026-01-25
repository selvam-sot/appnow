import express from 'express';
import { protect, authorize } from '../../middlewares/auth.middleware';
import {
    getAllReviews,
    updateReviewStatus,
    deleteReview
} from '../../controllers/review.controller';

const router = express.Router();

// All admin routes require authentication and admin role
router.get('/', protect, authorize('admin'), getAllReviews);
router.put('/:id/status', protect, authorize('admin'), updateReviewStatus);
router.delete('/:id', protect, authorize('admin'), deleteReview);

export default router;
