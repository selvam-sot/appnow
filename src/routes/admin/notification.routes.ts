import { Router } from 'express';
import { protectAdmin } from '../../middlewares/admin-auth.middleware';
import { sendNotification, debugPushTokens, getVendorNotifications } from '../../controllers/notification.controller';

const router = Router();

// All admin routes require authentication
router.use(protectAdmin);

// GET /api/v1/admin/notifications/vendor - Get vendor notifications (activity feed)
router.get('/vendor', getVendorNotifications);

// POST /api/v1/admin/notifications/send - Send notification to users
router.post('/send', sendNotification);

// GET /api/v1/admin/notifications/debug - Debug push token status
router.get('/debug', debugPushTokens);

export default router;
