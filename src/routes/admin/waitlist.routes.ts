import { Router, Request, Response } from 'express';
import { protectAdmin } from '../../middlewares/admin-auth.middleware';
import Waitlist from '../../models/waitlist.model';

const router = Router();
router.use(protectAdmin);

// GET / — List all waitlist entries with pagination, filters
router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const { page = 1, limit = 20, status, vendorServiceId, date } = req.query;
        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);

        const filter: any = {};
        if (status) filter.status = status;
        if (vendorServiceId) filter.vendorServiceId = vendorServiceId;
        if (date) filter.preferredDate = date;

        const [entries, total] = await Promise.all([
            Waitlist.find(filter)
                .populate('customerId', 'name email')
                .populate({
                    path: 'vendorServiceId',
                    select: 'name price',
                    populate: { path: 'vendorId', select: 'vendorName' },
                })
                .sort({ createdAt: -1 })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum)
                .lean(),
            Waitlist.countDocuments(filter),
        ]);

        res.status(200).json({
            success: true,
            data: {
                entries,
                pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
            },
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /stats — Waitlist analytics
router.get('/stats', async (_req: Request, res: Response): Promise<void> => {
    try {
        // Count by status
        const statusCounts = await Waitlist.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ]);

        // Most waitlisted services
        const mostWaitlisted = await Waitlist.aggregate([
            { $group: { _id: '$vendorServiceId', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'vendorservices',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'service',
                },
            },
            { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
            { $project: { serviceName: '$service.name', count: 1 } },
        ]);

        // Recent activity
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

        const [todayCount, weekCount] = await Promise.all([
            Waitlist.countDocuments({ createdAt: { $gte: today } }),
            Waitlist.countDocuments({ createdAt: { $gte: weekAgo } }),
        ]);

        res.status(200).json({
            success: true,
            data: {
                statusDistribution: Object.fromEntries(statusCounts.map((s: any) => [s._id, s.count])),
                mostWaitlisted,
                todayCount,
                weekCount,
            },
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /:id — Remove a waitlist entry
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const entry = await Waitlist.findByIdAndDelete(req.params.id);
        if (!entry) {
            res.status(404).json({ success: false, error: 'Waitlist entry not found' });
            return;
        }
        res.status(200).json({ success: true, message: 'Waitlist entry deleted' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
