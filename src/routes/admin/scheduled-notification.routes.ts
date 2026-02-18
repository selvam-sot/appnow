import { Router, Request, Response } from 'express';
import { protectAdmin } from '../../middlewares/admin-auth.middleware';
import ScheduledNotification from '../../models/scheduled-notification.model';

const router = Router();
router.use(protectAdmin);

// GET / — List scheduled notifications with pagination, filters
router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const { page = 1, limit = 20, status, type } = req.query;
        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);

        const filter: any = {};
        if (status) filter.status = status;
        if (type) filter.type = type;

        const [notifications, total] = await Promise.all([
            ScheduledNotification.find(filter)
                .populate('customerId', 'name email')
                .populate('appointmentId', 'appointmentDate startTime')
                .sort({ scheduledFor: -1 })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum)
                .lean(),
            ScheduledNotification.countDocuments(filter),
        ]);

        res.status(200).json({
            success: true,
            data: {
                notifications,
                pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
            },
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /stats — Notification delivery stats
router.get('/stats', async (_req: Request, res: Response): Promise<void> => {
    try {
        // Count by status
        const statusCounts = await ScheduledNotification.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ]);

        // Count by type
        const typeCounts = await ScheduledNotification.aggregate([
            { $group: { _id: '$type', count: { $sum: 1 } } },
        ]);

        const statusMap = Object.fromEntries(statusCounts.map((s: any) => [s._id, s.count]));
        const sent = statusMap['sent'] || 0;
        const failed = statusMap['failed'] || 0;
        const successRate = sent + failed > 0 ? ((sent / (sent + failed)) * 100).toFixed(1) : '0';

        // Recent failures
        const recentFailures = await ScheduledNotification.find({ status: 'failed' })
            .select('title body failureReason scheduledFor createdAt')
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();

        res.status(200).json({
            success: true,
            data: {
                statusDistribution: statusMap,
                typeDistribution: Object.fromEntries(typeCounts.map((t: any) => [t._id, t.count])),
                successRate: `${successRate}%`,
                recentFailures,
            },
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /:id/cancel — Cancel a pending notification
router.post('/:id/cancel', async (req: Request, res: Response): Promise<void> => {
    try {
        const notification = await ScheduledNotification.findById(req.params.id);
        if (!notification) {
            res.status(404).json({ success: false, error: 'Notification not found' });
            return;
        }

        if ((notification as any).status !== 'pending') {
            res.status(400).json({ success: false, error: `Cannot cancel notification with status '${(notification as any).status}'` });
            return;
        }

        (notification as any).status = 'cancelled';
        (notification as any).cancelledAt = new Date();
        await notification.save();

        res.status(200).json({ success: true, data: notification });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
