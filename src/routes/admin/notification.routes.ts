import { Router } from 'express';
import { protectAdmin } from '../../middlewares/admin-auth.middleware';
import { sendNotification, debugPushTokens } from '../../controllers/notification.controller';

const router = Router();

// All admin routes require authentication
router.use(protectAdmin);

// POST /api/v1/admin/notifications/send - Send notification to users
router.post('/send', sendNotification);

// GET /api/v1/admin/notifications/debug - Debug push token status
router.get('/debug', debugPushTokens);

export default router;
