import { Router } from 'express';
import { joinWaitlist, leaveWaitlist, getMyWaitlist } from '../../controllers/waitlist.controller';

const router = Router();

router.post('/join', joinWaitlist);
router.delete('/:id', leaveWaitlist);
router.get('/my-waitlist/:clerkId', getMyWaitlist);

export default router;
