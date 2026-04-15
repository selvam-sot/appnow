import { Router } from 'express';
import {
  getLoyaltyAccount,
  getPointsHistory,
  redeemPoints,
} from '../../controllers/loyalty.controller';
import { protect } from '../../middlewares/auth.middleware';

const router = Router();

router.use(protect);

router.get('/:clerkId', getLoyaltyAccount);
router.get('/:clerkId/history', getPointsHistory);
router.post('/redeem', redeemPoints);

export default router;
