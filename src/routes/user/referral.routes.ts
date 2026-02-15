import { Router } from 'express';
import { getReferralInfo, applyReferralCode } from '../../controllers/referral.controller';

const router = Router();

router.get('/:clerkId', getReferralInfo);
router.post('/apply', applyReferralCode);

export default router;
