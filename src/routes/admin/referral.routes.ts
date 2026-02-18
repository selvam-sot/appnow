import { Router, Request, Response } from 'express';
import { protectAdmin } from '../../middlewares/admin-auth.middleware';
import Referral from '../../models/referral.model';

const router = Router();
router.use(protectAdmin);

// GET / — List all referrals with pagination, filters
router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const { page = 1, limit = 20, status, search } = req.query;
        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);

        const filter: any = { referredClerkId: { $ne: '' } }; // Exclude placeholder entries
        if (status) filter.status = status;
        if (search) {
            filter.$or = [
                { referralCode: { $regex: search, $options: 'i' } },
                { referrerId: { $regex: search, $options: 'i' } },
                { referredClerkId: { $regex: search, $options: 'i' } },
            ];
        }

        const [referrals, total] = await Promise.all([
            Referral.find(filter)
                .sort({ createdAt: -1 })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum)
                .lean(),
            Referral.countDocuments(filter),
        ]);

        res.status(200).json({
            success: true,
            data: {
                referrals,
                pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
            },
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /stats — Referral program stats
router.get('/stats', async (_req: Request, res: Response): Promise<void> => {
    try {
        const [
            totalCodes,
            totalSuccessful,
            totalRewarded,
        ] = await Promise.all([
            Referral.countDocuments({ referredClerkId: '' }), // Placeholder entries = unique codes
            Referral.countDocuments({ referredClerkId: { $ne: '' } }),
            Referral.countDocuments({ rewardGiven: true }),
        ]);

        // Top referrers
        const topReferrers = await Referral.aggregate([
            { $match: { referredClerkId: { $ne: '' } } },
            { $group: { _id: '$referrerId', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
        ]);

        res.status(200).json({
            success: true,
            data: {
                totalCodes,
                totalSuccessful,
                totalRewarded,
                topReferrers,
            },
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /:id — Delete a referral entry
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const entry = await Referral.findByIdAndDelete(req.params.id);
        if (!entry) {
            res.status(404).json({ success: false, error: 'Referral not found' });
            return;
        }
        res.status(200).json({ success: true, message: 'Referral deleted' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
