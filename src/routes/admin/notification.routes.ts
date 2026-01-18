import { Router } from 'express';
import { sendNotification } from '../../controllers/notification.controller';

const router = Router();

// POST /api/v1/admin/notifications/send - Send notification to users
router.post('/send', sendNotification);

export default router;
