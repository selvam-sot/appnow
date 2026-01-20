import { Router } from 'express';
import {
    getUserNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    registerPushToken,
    removePushToken,
} from '../../controllers/notification.controller';

const router = Router();

// Push token management
// POST /api/v1/customer/notifications/push-token - Register push token
router.post('/push-token', registerPushToken);

// DELETE /api/v1/customer/notifications/push-token - Remove push token
router.delete('/push-token', removePushToken);

// GET /api/v1/customer/notifications/:clerkId - Get user notifications
router.get('/:clerkId', getUserNotifications);

// GET /api/v1/customer/notifications/:clerkId/unread-count - Get unread count
router.get('/:clerkId/unread-count', getUnreadCount);

// PATCH /api/v1/customer/notifications/:notificationId/read - Mark as read
router.patch('/:notificationId/read', markAsRead);

// PATCH /api/v1/customer/notifications/:clerkId/read-all - Mark all as read
router.patch('/:clerkId/read-all', markAllAsRead);

// DELETE /api/v1/customer/notifications/:notificationId - Delete notification
router.delete('/:notificationId', deleteNotification);

// DELETE /api/v1/customer/notifications/:clerkId/all - Delete all notifications
router.delete('/:clerkId/all', deleteAllNotifications);

export default router;
