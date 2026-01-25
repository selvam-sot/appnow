import express from 'express';
import { protectAdmin } from '../../middlewares/admin-auth.middleware';
import {
    getAllReviews,
    updateReviewStatus,
    deleteReview
} from '../../controllers/review.controller';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(protectAdmin);

router.get('/', getAllReviews);
router.put('/:id/status', updateReviewStatus);
router.delete('/:id', deleteReview);

export default router;
