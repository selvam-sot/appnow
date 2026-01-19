import { Router } from 'express';
import { sendNotification, debugPushTokens } from '../../controllers/notification.controller';

const router = Router();

// POST /api/v1/admin/notifications/send - Send notification to users
router.post('/send', sendNotification);

// GET /api/v1/admin/notifications/debug - Debug push token status
router.get('/debug', debugPushTokens);

export default router;
