import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.util';
import User from '../models/user.model';

interface ExpoPushMessage {
    to: string;
    sound?: 'default' | null;
    title: string;
    body: string;
    data?: Record<string, string>;
}

interface ExpoPushTicket {
    status: 'ok' | 'error';
    id?: string;
    message?: string;
    details?: { error: string };
}

/**
 * Send push notifications via Expo Push API
 */
async function sendExpoPushNotifications(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
    if (messages.length === 0) {
        return [];
    }

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
    });

    const result = await response.json() as { data?: ExpoPushTicket[] };
    return result.data || [];
}

/**
 * Send notification to all users or specific users
 * POST /api/v1/admin/notifications/send
 */
export const sendNotification = asyncHandler(async (req: Request, res: Response) => {
    const { targetType, userIds, title, body, data } = req.body;

    // Validate required fields
    if (!title || !body) {
        return res.status(400).json({
            success: false,
            message: 'Title and body are required',
        });
    }

    if (!targetType || !['all', 'specific'].includes(targetType)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid target type. Must be "all" or "specific"',
        });
    }

    if (targetType === 'specific' && (!userIds || !Array.isArray(userIds) || userIds.length === 0)) {
        return res.status(400).json({
            success: false,
            message: 'User IDs are required when target type is "specific"',
        });
    }

    // Build query to find users with push tokens
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: Record<string, any> = {
        expoPushToken: { $exists: true, $nin: [null, ''] },
        role: 'customer',
    };

    if (targetType === 'specific') {
        query._id = { $in: userIds };
    }

    // Get users with push tokens
    const users = await User.find(query).select('_id email expoPushToken').lean();

    if (users.length === 0) {
        return res.status(200).json({
            success: true,
            message: 'No users with push tokens found',
            sentCount: 0,
            failedCount: 0,
        });
    }

    // Prepare push messages
    const messages: ExpoPushMessage[] = users
        .filter(user => user.expoPushToken && user.expoPushToken.startsWith('ExponentPushToken'))
        .map(user => ({
            to: user.expoPushToken!,
            sound: 'default' as const,
            title,
            body,
            data: data || {},
        }));

    if (messages.length === 0) {
        return res.status(200).json({
            success: true,
            message: 'No valid Expo push tokens found',
            sentCount: 0,
            failedCount: 0,
        });
    }

    // Send notifications in batches of 100 (Expo limit)
    const batchSize = 100;
    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize);
        try {
            const tickets = await sendExpoPushNotifications(batch);

            for (const ticket of tickets) {
                if (ticket.status === 'ok') {
                    sentCount++;
                } else {
                    failedCount++;
                    console.error('Push notification failed:', ticket.message, ticket.details);
                }
            }
        } catch (error) {
            console.error('Error sending push notifications batch:', error);
            failedCount += batch.length;
        }
    }

    res.status(200).json({
        success: true,
        message: `Notification sent to ${sentCount} user(s)`,
        sentCount,
        failedCount,
    });
});

/**
 * Register push token for a user
 * POST /api/v1/users/push-token
 * Accepts either clerkId or MongoDB _id
 */
export const registerPushToken = asyncHandler(async (req: Request, res: Response) => {
    const { userId, clerkId, pushToken } = req.body;

    console.log('[registerPushToken] Request received:', { userId, clerkId, pushToken: pushToken?.substring(0, 30) + '...' });

    if ((!userId && !clerkId) || !pushToken) {
        console.log('[registerPushToken] Missing required fields');
        return res.status(400).json({
            success: false,
            message: 'User ID (or clerkId) and push token are required',
        });
    }

    // Validate Expo push token format
    if (!pushToken.startsWith('ExponentPushToken')) {
        console.log('[registerPushToken] Invalid token format');
        return res.status(400).json({
            success: false,
            message: 'Invalid Expo push token format',
        });
    }

    // Find user by clerkId or MongoDB _id
    let user;
    if (clerkId) {
        console.log('[registerPushToken] Looking up user by clerkId:', clerkId);
        user = await User.findOneAndUpdate(
            { clerkId },
            { expoPushToken: pushToken },
            { new: true }
        );
        console.log('[registerPushToken] User found by clerkId:', user ? user.email : 'NOT FOUND');
    } else {
        console.log('[registerPushToken] Looking up user by userId:', userId);
        user = await User.findByIdAndUpdate(
            userId,
            { expoPushToken: pushToken },
            { new: true }
        );
        console.log('[registerPushToken] User found by userId:', user ? user.email : 'NOT FOUND');
    }

    if (!user) {
        console.log('[registerPushToken] User not found for clerkId:', clerkId, 'or userId:', userId);
        return res.status(404).json({
            success: false,
            message: 'User not found',
        });
    }

    console.log('[registerPushToken] Push token saved successfully for user:', user.email);
    res.status(200).json({
        success: true,
        message: 'Push token registered successfully',
    });
});

/**
 * Debug endpoint: Get all users with their push token status
 * GET /api/v1/admin/notifications/debug
 */
export const debugPushTokens = asyncHandler(async (req: Request, res: Response) => {
    // Get all customer users
    const allUsers = await User.find({ role: 'customer' })
        .select('_id email clerkId expoPushToken role createdAt')
        .lean();

    const usersWithTokens = allUsers.filter(u => u.expoPushToken);
    const usersWithoutTokens = allUsers.filter(u => !u.expoPushToken);

    res.status(200).json({
        success: true,
        totalCustomers: allUsers.length,
        withPushTokens: usersWithTokens.length,
        withoutPushTokens: usersWithoutTokens.length,
        users: allUsers.map(u => ({
            _id: u._id,
            email: u.email,
            clerkId: u.clerkId || null,
            hasExpoPushToken: !!u.expoPushToken,
            expoPushToken: u.expoPushToken ? `${u.expoPushToken.substring(0, 30)}...` : null,
        })),
    });
});

/**
 * Remove push token for a user (on logout or disable notifications)
 * DELETE /api/v1/users/push-token
 * Accepts either clerkId or MongoDB _id
 */
export const removePushToken = asyncHandler(async (req: Request, res: Response) => {
    const { userId, clerkId } = req.body;

    if (!userId && !clerkId) {
        return res.status(400).json({
            success: false,
            message: 'User ID or clerkId is required',
        });
    }

    // Find user by clerkId or MongoDB _id
    let user;
    if (clerkId) {
        user = await User.findOneAndUpdate(
            { clerkId },
            { $unset: { expoPushToken: 1 } },
            { new: true }
        );
    } else {
        user = await User.findByIdAndUpdate(
            userId,
            { $unset: { expoPushToken: 1 } },
            { new: true }
        );
    }

    if (!user) {
        return res.status(404).json({
            success: false,
            message: 'User not found',
        });
    }

    res.status(200).json({
        success: true,
        message: 'Push token removed successfully',
    });
});
