/**
 * Push Notification Service
 * Handles sending push notifications via Expo Push API
 */

import User from '../models/user.model';
import Notification from '../models/notification.model';

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

interface SendNotificationOptions {
    userId?: string; // MongoDB _id
    clerkId?: string; // Clerk user ID
    title: string;
    body: string;
    type: 'appointment' | 'reminder' | 'promotion' | 'system';
    data?: Record<string, string>;
    saveToDatabase?: boolean;
}

interface SendNotificationResult {
    success: boolean;
    pushSent: boolean;
    savedToDb: boolean;
    error?: string;
}

/**
 * Send push notifications via Expo Push API
 */
async function sendExpoPushNotifications(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
    if (messages.length === 0) {
        return [];
    }

    try {
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
    } catch (error) {
        console.error('Error sending Expo push notifications:', error);
        return [];
    }
}

/**
 * Send notification to a single user
 */
export async function sendNotificationToUser(options: SendNotificationOptions): Promise<SendNotificationResult> {
    const { userId, clerkId, title, body, type, data = {}, saveToDatabase = true } = options;

    const result: SendNotificationResult = {
        success: false,
        pushSent: false,
        savedToDb: false,
    };

    try {
        // Find user by either userId or clerkId
        let user;
        if (clerkId) {
            user = await User.findOne({ clerkId }).select('_id clerkId expoPushToken').lean();
        } else if (userId) {
            user = await User.findById(userId).select('_id clerkId expoPushToken').lean();
        }

        if (!user) {
            result.error = 'User not found';
            return result;
        }

        const userClerkId = user.clerkId;

        // Save notification to database
        if (saveToDatabase && userClerkId) {
            try {
                await Notification.create({
                    userId: userClerkId,
                    type,
                    title,
                    body,
                    data,
                    read: false,
                });
                result.savedToDb = true;
                console.log(`[PushNotification] Saved notification to DB for user ${userClerkId}`);
            } catch (dbError) {
                console.error('[PushNotification] Error saving notification to DB:', dbError);
            }
        }

        // Send push notification if user has a valid Expo push token
        if (user.expoPushToken && user.expoPushToken.startsWith('ExponentPushToken')) {
            const message: ExpoPushMessage = {
                to: user.expoPushToken,
                sound: 'default',
                title,
                body,
                data: { ...data, type },
            };

            const tickets = await sendExpoPushNotifications([message]);

            if (tickets.length > 0 && tickets[0].status === 'ok') {
                result.pushSent = true;
                console.log(`[PushNotification] Push notification sent to user ${userClerkId}`);
            } else if (tickets.length > 0) {
                console.error('[PushNotification] Push notification failed:', tickets[0].message);
            }
        } else {
            console.log(`[PushNotification] User ${userClerkId} has no valid push token`);
        }

        result.success = result.savedToDb || result.pushSent;
        return result;

    } catch (error: any) {
        console.error('[PushNotification] Error sending notification:', error);
        result.error = error.message || 'Unknown error';
        return result;
    }
}

/**
 * Send booking confirmation notification
 */
export async function sendBookingConfirmationNotification(
    userId: string,
    appointmentDetails: {
        serviceName: string;
        vendorName?: string;
        date: string;
        time: string;
        appointmentId: string;
    }
): Promise<SendNotificationResult> {
    const { serviceName, vendorName, date, time, appointmentId } = appointmentDetails;

    const title = 'Booking Confirmed!';
    const body = vendorName
        ? `Your appointment for ${serviceName} with ${vendorName} on ${date} at ${time} has been confirmed.`
        : `Your appointment for ${serviceName} on ${date} at ${time} has been confirmed.`;

    return sendNotificationToUser({
        userId,
        title,
        body,
        type: 'appointment',
        data: {
            appointmentId,
            serviceName,
            date,
            time,
        },
        saveToDatabase: true,
    });
}

/**
 * Send appointment reminder notification
 */
export async function sendAppointmentReminderNotification(
    userId: string,
    appointmentDetails: {
        serviceName: string;
        vendorName?: string;
        date: string;
        time: string;
        appointmentId: string;
        reminderType?: '24h' | '1h';
    }
): Promise<SendNotificationResult> {
    const { serviceName, vendorName, date, time, appointmentId, reminderType = '1h' } = appointmentDetails;

    // Customize title based on reminder type
    const title = reminderType === '1h'
        ? 'Appointment in 1 Hour!'
        : 'Appointment Tomorrow';

    // Customize body based on reminder type
    let body: string;
    if (reminderType === '1h') {
        body = vendorName
            ? `Your ${serviceName} appointment with ${vendorName} starts at ${time}. Get ready!`
            : `Your ${serviceName} appointment starts at ${time}. Get ready!`;
    } else {
        body = vendorName
            ? `Reminder: Your ${serviceName} appointment with ${vendorName} is tomorrow (${date}) at ${time}.`
            : `Reminder: Your ${serviceName} appointment is tomorrow (${date}) at ${time}.`;
    }

    return sendNotificationToUser({
        userId,
        title,
        body,
        type: 'reminder',
        data: {
            appointmentId,
            serviceName,
            date,
            time,
            reminderType,
        },
        saveToDatabase: true,
    });
}

/**
 * Send appointment cancellation notification
 */
export async function sendAppointmentCancellationNotification(
    userId: string,
    appointmentDetails: {
        serviceName: string;
        date: string;
        time: string;
        appointmentId: string;
        reason?: string;
    }
): Promise<SendNotificationResult> {
    const { serviceName, date, time, appointmentId, reason } = appointmentDetails;

    const title = 'Appointment Cancelled';
    const body = reason
        ? `Your appointment for ${serviceName} on ${date} at ${time} has been cancelled. Reason: ${reason}`
        : `Your appointment for ${serviceName} on ${date} at ${time} has been cancelled.`;

    return sendNotificationToUser({
        userId,
        title,
        body,
        type: 'appointment',
        data: {
            appointmentId,
            serviceName,
            date,
            time,
            cancelled: 'true',
        },
        saveToDatabase: true,
    });
}

export default {
    sendNotificationToUser,
    sendBookingConfirmationNotification,
    sendAppointmentReminderNotification,
    sendAppointmentCancellationNotification,
};
