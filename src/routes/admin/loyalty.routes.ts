import { Router, Request, Response } from 'express';
import { protectAdmin } from '../../middlewares/admin-auth.middleware';
import LoyaltyAccount from '../../models/loyalty-account.model';

const router = Router();
router.use(protectAdmin);

// GET / — List all loyalty accounts with pagination, search, tier filter
router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const { page = 1, limit = 20, search, tier } = req.query;
        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);

        const filter: any = {};
        if (tier) filter.tier = tier;

        // If search provided, find matching user IDs first
        if (search) {
            const User = require('../../models/user.model').default;
            const matchingUsers = await User.find({
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                    { clerkId: { $regex: search, $options: 'i' } },
                ],
            }).select('_id');
            filter.userId = { $in: matchingUsers.map((u: any) => u._id) };
        }

        const [accounts, total] = await Promise.all([
            LoyaltyAccount.find(filter)
                .populate('userId', 'name email clerkId')
                .sort({ totalEarned: -1 })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum)
                .lean(),
            LoyaltyAccount.countDocuments(filter),
        ]);

        // Summary stats
        const [stats] = await LoyaltyAccount.aggregate([
            {
                $group: {
                    _id: null,
                    totalAccounts: { $sum: 1 },
                    totalPointsInCirculation: { $sum: '$points' },
                    totalEarned: { $sum: '$totalEarned' },
                    totalRedeemed: { $sum: '$totalRedeemed' },
                },
            },
        ]);

        const tierCounts = await LoyaltyAccount.aggregate([
            { $group: { _id: '$tier', count: { $sum: 1 } } },
        ]);

        res.status(200).json({
            success: true,
            data: {
                accounts,
                pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
                summary: {
                    ...(stats || { totalAccounts: 0, totalPointsInCirculation: 0, totalEarned: 0, totalRedeemed: 0 }),
                    tierDistribution: Object.fromEntries(tierCounts.map((t: any) => [t._id, t.count])),
                },
            },
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /stats — Loyalty program overview
router.get('/stats', async (_req: Request, res: Response): Promise<void> => {
    try {
        const [stats] = await LoyaltyAccount.aggregate([
            {
                $group: {
                    _id: null,
                    totalAccounts: { $sum: 1 },
                    totalPointsInCirculation: { $sum: '$points' },
                    totalEarned: { $sum: '$totalEarned' },
                    totalRedeemed: { $sum: '$totalRedeemed' },
                },
            },
        ]);

        const tierDistribution = await LoyaltyAccount.aggregate([
            { $group: { _id: '$tier', count: { $sum: 1 } } },
        ]);

        // Recent transactions across all accounts (last 10)
        const recentTransactions = await LoyaltyAccount.aggregate([
            { $unwind: '$history' },
            { $sort: { 'history.createdAt': -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'user',
                },
            },
            { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    userName: '$user.name',
                    userEmail: '$user.email',
                    clerkId: 1,
                    transaction: '$history',
                },
            },
        ]);

        res.status(200).json({
            success: true,
            data: {
                ...(stats || { totalAccounts: 0, totalPointsInCirculation: 0, totalEarned: 0, totalRedeemed: 0 }),
                tierDistribution: Object.fromEntries(tierDistribution.map((t: any) => [t._id, t.count])),
                recentTransactions,
            },
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /:id — Get single loyalty account
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const account = await LoyaltyAccount.findById(req.params.id)
            .populate('userId', 'name email clerkId phone')
            .lean();

        if (!account) {
            res.status(404).json({ success: false, error: 'Loyalty account not found' });
            return;
        }

        res.status(200).json({ success: true, data: account });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /:id/adjust — Manually adjust points
router.post('/:id/adjust', async (req: Request, res: Response): Promise<void> => {
    try {
        const { points, type, description } = req.body;

        if (!points || !type || !description) {
            res.status(400).json({ success: false, error: 'points, type, and description are required' });
            return;
        }

        const account = await LoyaltyAccount.findById(req.params.id);
        if (!account) {
            res.status(404).json({ success: false, error: 'Loyalty account not found' });
            return;
        }

        account.points += points;
        if (points > 0) account.totalEarned += points;
        if (points < 0) account.totalRedeemed += Math.abs(points);

        account.history.push({
            type: type as 'bonus' | 'redeemed',
            points,
            description: `[Admin] ${description}`,
            createdAt: new Date(),
        });

        await account.save();

        res.status(200).json({ success: true, data: account });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /:id/history — Paginated transaction history
router.get('/:id/history', async (req: Request, res: Response): Promise<void> => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);

        const account = await LoyaltyAccount.findById(req.params.id);
        if (!account) {
            res.status(404).json({ success: false, error: 'Loyalty account not found' });
            return;
        }

        const sorted = [...account.history].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        const paginated = sorted.slice((pageNum - 1) * limitNum, pageNum * limitNum);

        res.status(200).json({
            success: true,
            data: {
                history: paginated,
                pagination: { total: sorted.length, page: pageNum, limit: limitNum, pages: Math.ceil(sorted.length / limitNum) },
            },
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
