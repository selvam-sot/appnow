import { Router } from 'express';
import { getLoyaltyAccount, getPointsHistory, redeemPoints } from '../../controllers/loyalty.controller';

const router = Router();

router.get('/:clerkId', getLoyaltyAccount);
router.get('/:clerkId/history', getPointsHistory);
router.post('/redeem', redeemPoints);

export default router;
