import { Request, Response } from 'express';
import mongoose from 'mongoose';
import LoyaltyAccount from '../models/loyalty-account.model';
import User from '../models/user.model';

/**
 * Get loyalty account for a user (creates one if it doesn't exist)
 * @route GET /api/user/loyalty/:clerkId
 */
export const getLoyaltyAccount = async (req: Request, res: Response): Promise<void> => {
    try {
        const { clerkId } = req.params;

        if (!clerkId) {
            res.status(400).json({
                success: false,
                error: 'clerkId is required',
            });
            return;
        }

        // Try to find existing loyalty account
        let account = await LoyaltyAccount.findOne({ clerkId });

        if (!account) {
            // Look up the user to get userId
            const user = await User.findOne({ clerkId });

            if (!user) {
                res.status(404).json({
                    success: false,
                    error: 'User not found',
                });
                return;
            }

            // Create a new loyalty account
            account = await LoyaltyAccount.create({
                userId: user._id,
                clerkId,
                points: 0,
                totalEarned: 0,
                totalRedeemed: 0,
                tier: 'bronze',
                history: [],
            });
        }

        res.status(200).json({
            success: true,
            data: account,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
        });
    }
};

/**
 * Get points transaction history for a user
 * @route GET /api/user/loyalty/:clerkId/history
 */
export const getPointsHistory = async (req: Request, res: Response): Promise<void> => {
    try {
        const { clerkId } = req.params;
        const { page = 1, limit = 20 } = req.query;

        if (!clerkId) {
            res.status(400).json({
                success: false,
                error: 'clerkId is required',
            });
            return;
        }

        const account = await LoyaltyAccount.findOne({ clerkId });

        if (!account) {
            res.status(404).json({
                success: false,
                error: 'Loyalty account not found',
            });
            return;
        }

        // Sort history by createdAt descending (most recent first)
        const sortedHistory = [...account.history].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);
        const startIndex = (pageNum - 1) * limitNum;
        const paginatedHistory = sortedHistory.slice(startIndex, startIndex + limitNum);

        res.status(200).json({
            success: true,
            data: {
                history: paginatedHistory,
                pagination: {
                    total: sortedHistory.length,
                    page: pageNum,
                    limit: limitNum,
                    pages: Math.ceil(sortedHistory.length / limitNum),
                },
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
        });
    }
};

/**
 * Redeem loyalty points (100 points = $5 discount)
 * @route POST /api/user/loyalty/redeem
 */
export const redeemPoints = async (req: Request, res: Response): Promise<void> => {
    try {
        const { clerkId, points, description } = req.body;

        if (!clerkId || !points) {
            res.status(400).json({
                success: false,
                error: 'clerkId and points are required',
            });
            return;
        }

        if (points <= 0 || points % 100 !== 0) {
            res.status(400).json({
                success: false,
                error: 'Points must be a positive number and a multiple of 100',
            });
            return;
        }

        const account = await LoyaltyAccount.findOne({ clerkId });

        if (!account) {
            res.status(404).json({
                success: false,
                error: 'Loyalty account not found',
            });
            return;
        }

        if (account.points < points) {
            res.status(400).json({
                success: false,
                error: 'Insufficient points',
                data: {
                    available: account.points,
                    requested: points,
                },
            });
            return;
        }

        // Calculate dollar value (100 points = $5)
        const dollarValue = (points / 100) * 5;

        // Deduct points and record transaction
        account.points -= points;
        account.totalRedeemed += points;
        account.history.push({
            type: 'redeemed',
            points: -points,
            description: description || `Redeemed ${points} points for $${dollarValue.toFixed(2)} discount`,
            createdAt: new Date(),
        });

        await account.save();

        res.status(200).json({
            success: true,
            data: {
                pointsRedeemed: points,
                dollarValue,
                remainingPoints: account.points,
                tier: account.tier,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
        });
    }
};

/**
 * Award loyalty points to a user (internal function, called after payment completes)
 * 1 point per $1 spent
 * @param clerkId - The Clerk user ID
 * @param amount - The dollar amount spent
 * @param appointmentId - Optional appointment ID to link to the transaction
 * @param description - Optional description for the transaction
 */
export const awardPoints = async (
    clerkId: string,
    amount: number,
    appointmentId?: string,
    description?: string
): Promise<void> => {
    try {
        if (!clerkId || !amount || amount <= 0) {
            return;
        }

        // Calculate points: 1 point per $1 spent (rounded down)
        const pointsToAward = Math.floor(amount);

        if (pointsToAward <= 0) {
            return;
        }

        // Find or create the loyalty account
        let account = await LoyaltyAccount.findOne({ clerkId });

        if (!account) {
            // Look up the user to get userId
            const user = await User.findOne({ clerkId });

            if (!user) {
                return;
            }

            account = await LoyaltyAccount.create({
                userId: user._id,
                clerkId,
                points: 0,
                totalEarned: 0,
                totalRedeemed: 0,
                tier: 'bronze',
                history: [],
            });
        }

        // Add points and record transaction
        account.points += pointsToAward;
        account.totalEarned += pointsToAward;
        account.history.push({
            type: 'earned',
            points: pointsToAward,
            description: description || `Earned ${pointsToAward} points for $${amount.toFixed(2)} payment`,
            appointmentId: appointmentId ? new mongoose.Types.ObjectId(appointmentId) : undefined,
            createdAt: new Date(),
        });

        await account.save();
    } catch (error) {
        // Log but don't throw - points award should not break the payment flow
        console.error('Error awarding loyalty points:', error instanceof Error ? error.message : 'Unknown error');
    }
};
