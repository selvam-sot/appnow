import { Router, Request, Response } from 'express';
import { protectAdmin } from '../../middlewares/admin-auth.middleware';
import SearchLog from '../../models/search-log.model';

const router = Router();
router.use(protectAdmin);

// GET /stats — Search analytics
router.get('/stats', async (_req: Request, res: Response): Promise<void> => {
    try {
        const now = new Date();
        const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

        // Most searched services (all time)
        const mostSearched = await SearchLog.aggregate([
            { $group: { _id: { serviceId: '$serviceId', serviceName: '$serviceName' }, count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 20 },
            { $project: { serviceId: '$_id.serviceId', serviceName: '$_id.serviceName', count: 1, _id: 0 } },
        ]);

        // Search volume by period
        const [last7d, last30d, last90d] = await Promise.all([
            SearchLog.countDocuments({ searchedAt: { $gte: daysAgo(7) } }),
            SearchLog.countDocuments({ searchedAt: { $gte: daysAgo(30) } }),
            SearchLog.countDocuments({ searchedAt: { $gte: daysAgo(90) } }),
        ]);

        // Daily search volume (last 30 days)
        const dailyVolume = await SearchLog.aggregate([
            { $match: { searchedAt: { $gte: daysAgo(30) } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$searchedAt' } },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        res.status(200).json({
            success: true,
            data: {
                mostSearched,
                volume: { last7d, last30d, last90d },
                dailyVolume,
            },
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /trending — Trending searches (last 7 days)
router.get('/trending', async (_req: Request, res: Response): Promise<void> => {
    try {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const trending = await SearchLog.aggregate([
            { $match: { searchedAt: { $gte: weekAgo } } },
            { $group: { _id: { serviceId: '$serviceId', serviceName: '$serviceName' }, count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            { $project: { serviceId: '$_id.serviceId', serviceName: '$_id.serviceName', count: 1, _id: 0 } },
        ]);

        res.status(200).json({ success: true, data: trending });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /clear — Clear all search logs
router.delete('/clear', async (_req: Request, res: Response): Promise<void> => {
    try {
        const result = await SearchLog.deleteMany({});
        res.status(200).json({ success: true, message: `Deleted ${result.deletedCount} search logs` });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
