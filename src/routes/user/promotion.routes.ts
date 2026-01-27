import express from 'express';
import * as promotionController from '../../controllers/promotion.controller';

const router = express.Router();

// Public routes - no authentication required

// Get banner promotions (for home screen)
router.get('/banners', promotionController.getBannerPromotions);

// Get all active promotions (for offers page)
router.get('/', promotionController.getActivePromotions);

// Validate a promo code
router.post('/validate', promotionController.validatePromoCode);

// Apply a promo code (increment usage)
router.post('/apply', promotionController.applyPromoCode);

export default router;
