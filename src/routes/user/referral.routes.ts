import { Router } from 'express';
import { getReferralInfo, applyReferralCode } from '../../controllers/referral.controller';
import { protect } from '../../middlewares/auth.middleware';

const router = Router();

router.use(protect);

router.get('/:clerkId', getReferralInfo);
router.post('/apply', applyReferralCode);

export default router;
