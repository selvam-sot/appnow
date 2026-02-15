import { Request, Response } from 'express';
import Referral from '../models/referral.model';
import { AppError } from '../utils/appError.util';
import { asyncHandler } from '../utils/asyncHandler.util';
import { awardPoints } from '../controllers/loyalty.controller';
import logger from '../config/logger';

/**
 * Generate a 6-char alphanumeric uppercase referral code.
 * Format: APT + 3 random uppercase alphanumeric characters.
 */
function generateReferralCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let suffix = '';
    for (let i = 0; i < 3; i++) {
        suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `APT${suffix}`;
}

/**
 * GET /:clerkId
 * Returns or creates a referral code for the user, plus their referral list and count.
 */
export const getReferralInfo = asyncHandler(async (req: Request, res: Response) => {
    const { clerkId } = req.params;

    if (!clerkId) {
        throw new AppError('clerkId is required', 400);
    }

    // Check if the user already has a referral code (they are a referrer)
    let referral = await Referral.findOne({ referrerId: clerkId });

    let referralCode: string;

    if (referral) {
        referralCode = referral.referralCode;
    } else {
        // Generate a unique referral code
        let code = generateReferralCode();
        let attempts = 0;

        while (await Referral.findOne({ referralCode: code })) {
            code = generateReferralCode();
            attempts++;
            if (attempts > 10) {
                throw new AppError('Unable to generate unique referral code. Please try again.', 500);
            }
        }

        referralCode = code;

        // Create a placeholder referral entry for the user so we persist their code
        referral = await Referral.create({
            referrerId: clerkId,
            referredClerkId: '',
            referralCode,
            status: 'pending',
            rewardGiven: false,
        });
    }

    // Get all referrals made by this user (exclude the placeholder)
    const referrals = await Referral.find({
        referrerId: clerkId,
        referredClerkId: { $ne: '' },
    })
        .select('referredClerkId status createdAt')
        .sort({ createdAt: -1 })
        .lean();

    const totalReferrals = referrals.length;

    logger.info(`Referral info retrieved for user ${clerkId}, code: ${referralCode}, total referrals: ${totalReferrals}`);

    res.status(200).json({
        success: true,
        data: {
            referralCode,
            referrals,
            totalReferrals,
        },
    });
});

/**
 * POST /apply
 * Apply a referral code for a new user.
 * Body: { clerkId, referralCode }
 */
export const applyReferralCode = asyncHandler(async (req: Request, res: Response) => {
    const { clerkId, referralCode } = req.body;

    if (!clerkId || !referralCode) {
        throw new AppError('clerkId and referralCode are required', 400);
    }

    // Normalize the referral code
    const normalizedCode = referralCode.trim().toUpperCase();

    // Find the referral entry with this code
    const referrerEntry = await Referral.findOne({ referralCode: normalizedCode });

    if (!referrerEntry) {
        throw new AppError('Invalid referral code', 404);
    }

    // Prevent self-referral
    if (referrerEntry.referrerId === clerkId) {
        throw new AppError('You cannot use your own referral code', 400);
    }

    // Check if the user has already used a referral code
    const existingReferral = await Referral.findOne({
        referredClerkId: clerkId,
    });

    if (existingReferral) {
        throw new AppError('You have already used a referral code', 400);
    }

    // Create a new referral entry for this successful referral
    await Referral.create({
        referrerId: referrerEntry.referrerId,
        referredClerkId: clerkId,
        referralCode: `${normalizedCode}-${clerkId}`,
        status: 'completed',
        rewardGiven: true,
    });

    // Award 100 loyalty points to the referrer
    await awardPoints(
        referrerEntry.referrerId,
        100,
        undefined,
        'Referral bonus: A friend joined using your code'
    );

    // Award 100 loyalty points to the referred user
    await awardPoints(
        clerkId,
        100,
        undefined,
        'Welcome bonus: Joined via referral code'
    );

    logger.info(`Referral code ${normalizedCode} applied by user ${clerkId}, referrer: ${referrerEntry.referrerId}`);

    res.status(200).json({
        success: true,
        data: {
            message: 'Referral code applied successfully! Both you and your friend earned 100 points.',
            pointsAwarded: 100,
        },
    });
});
