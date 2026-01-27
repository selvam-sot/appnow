import express from 'express';
import { protectAdmin } from '../../middlewares/admin-auth.middleware';
import * as promotionController from '../../controllers/promotion.controller';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(protectAdmin);

router.route('/')
    .get(promotionController.getAllPromotions)
    .post(promotionController.createPromotion);

// Reorder promotions (must be before /:id route)
router.route('/reorder')
    .put(promotionController.reorderPromotions);

router.route('/:id')
    .get(promotionController.getPromotion)
    .put(promotionController.updatePromotion)
    .delete(promotionController.deletePromotion);

// Toggle routes
router.route('/:id/toggle-active')
    .patch(promotionController.toggleActive);

router.route('/:id/toggle-featured')
    .patch(promotionController.toggleFeatured);

router.route('/:id/toggle-banner')
    .patch(promotionController.toggleBanner);

export default router;
