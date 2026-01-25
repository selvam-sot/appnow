import express from 'express';
import {
    getAllLocks,
    forceReleaseLock,
    cleanupExpiredLocks
} from '../../controllers/slot-lock.controller';
import { sensitiveLimiter } from '../../middlewares/rateLimiter.middleware';

const router = express.Router();

// Apply rate limiting to sensitive operations
router.use(sensitiveLimiter);

// Get all active locks
router.get('/locks', getAllLocks);

// Force release a lock
router.delete('/locks/:lockId', forceReleaseLock);

// Manual cleanup of expired locks (TTL handles this automatically)
router.post('/locks/cleanup', cleanupExpiredLocks);

export default router;
