/**
 * Notification Scheduler Service
 *
 * Smart scheduling approach:
 * 1. When appointment is created/rescheduled: Schedule reminder notifications
 * 2. When appointment is cancelled: Cancel pending reminders
 * 3. Every minute: Process notifications that are due
 * 4. Daily at 12:01 AM: Verify all today's reminders are scheduled
 *
 * This avoids constant polling and ensures efficient notification delivery.
 */

import ScheduledNotification, { IScheduledNotification } from '../models/scheduled-notification.model';
import Appointment from '../models/appointment.model';
import User from '../models/user.model';
import { sendNotificationToUser } from './pushNotification.service';
import logger from '../config/logger';
import mongoose from 'mongoose';

interface AppointmentDetails {
    _id: string;
    customerId: string | { _id: string; clerkId?: string; firstName?: string };
    vendorServiceId?: string | {
        _id: string;
        name?: string;
        vendorId?: { vendorName?: string };
        serviceId?: { name?: string };
    };
    appointmentDate: Date;
    startTime: string;
    status: string;
}

/**
 * Schedule reminder notifications for an appointment
 * Called when appointment is created or rescheduled
 */
export async function scheduleAppointmentReminders(appointment: AppointmentDetails): Promise<void> {
    try {
        const appointmentId = appointment._id.toString();
        const customerId = typeof appointment.customerId === 'string'
            ? appointment.customerId
            : appointment.customerId._id.toString();

        // Don't schedule for cancelled/completed appointments
        if (['cancelled', 'completed', 'failed', 'missed'].includes(appointment.status)) {
            logger.info(`[NotificationScheduler] Skipping reminders for ${appointment.status} appointment ${appointmentId}`);
            return;
        }

        // Cancel any existing pending reminders for this appointment (in case of reschedule)
        await cancelAppointmentReminders(appointmentId);

        // Calculate appointment datetime
        const [hours, minutes] = appointment.startTime.split(':').map(Number);
        const appointmentDateTime = new Date(appointment.appointmentDate);
        appointmentDateTime.setHours(hours, minutes, 0, 0);

        const now = new Date();

        // Get service and vendor details for notification content
        let serviceName = 'your service';
        let vendorName: string | undefined;

        if (appointment.vendorServiceId && typeof appointment.vendorServiceId === 'object') {
            const vs = appointment.vendorServiceId;
            serviceName = vs.serviceId?.name || vs.name || 'your service';
            vendorName = vs.vendorId?.vendorName;
        }

        const formattedDate = appointmentDateTime.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        });

        const notificationsToCreate: Partial<IScheduledNotification>[] = [];

        // Schedule 1-hour reminder (if appointment is more than 1 hour away)
        const oneHourBefore = new Date(appointmentDateTime.getTime() - 60 * 60 * 1000);
        if (oneHourBefore > now) {
            notificationsToCreate.push({
                appointmentId: new mongoose.Types.ObjectId(appointmentId),
                customerId: new mongoose.Types.ObjectId(customerId),
                type: 'reminder_1h',
                scheduledFor: oneHourBefore,
                status: 'pending',
                title: 'Appointment in 1 Hour!',
                body: vendorName
                    ? `Your ${serviceName} appointment with ${vendorName} starts at ${appointment.startTime}. Get ready!`
                    : `Your ${serviceName} appointment starts at ${appointment.startTime}. Get ready!`,
                data: {
                    appointmentId,
                    serviceName,
                    vendorName,
                    date: formattedDate,
                    time: appointment.startTime,
                    type: 'reminder_1h',
                },
                retryCount: 0,
            });
        }

        // Schedule 24-hour reminder (if appointment is more than 24 hours away)
        const twentyFourHoursBefore = new Date(appointmentDateTime.getTime() - 24 * 60 * 60 * 1000);
        if (twentyFourHoursBefore > now) {
            notificationsToCreate.push({
                appointmentId: new mongoose.Types.ObjectId(appointmentId),
                customerId: new mongoose.Types.ObjectId(customerId),
                type: 'reminder_24h',
                scheduledFor: twentyFourHoursBefore,
                status: 'pending',
                title: 'Appointment Tomorrow',
                body: vendorName
                    ? `Reminder: Your ${serviceName} appointment with ${vendorName} is tomorrow (${formattedDate}) at ${appointment.startTime}.`
                    : `Reminder: Your ${serviceName} appointment is tomorrow (${formattedDate}) at ${appointment.startTime}.`,
                data: {
                    appointmentId,
                    serviceName,
                    vendorName,
                    date: formattedDate,
                    time: appointment.startTime,
                    type: 'reminder_24h',
                },
                retryCount: 0,
            });
        }

        // Create scheduled notifications
        if (notificationsToCreate.length > 0) {
            await ScheduledNotification.insertMany(notificationsToCreate);
            logger.info(`[NotificationScheduler] Scheduled ${notificationsToCreate.length} reminders for appointment ${appointmentId}`);
        } else {
            logger.info(`[NotificationScheduler] No reminders to schedule for appointment ${appointmentId} (too close to start time)`);
        }

    } catch (error: any) {
        logger.error(`[NotificationScheduler] Error scheduling reminders: ${error.message}`);
    }
}

/**
 * Cancel all pending reminders for an appointment
 * Called when appointment is cancelled
 */
export async function cancelAppointmentReminders(appointmentId: string): Promise<number> {
    try {
        const result = await ScheduledNotification.updateMany(
            {
                appointmentId: new mongoose.Types.ObjectId(appointmentId),
                status: 'pending'
            },
            {
                $set: {
                    status: 'cancelled',
                    cancelledAt: new Date()
                }
            }
        );

        if (result.modifiedCount > 0) {
            logger.info(`[NotificationScheduler] Cancelled ${result.modifiedCount} reminders for appointment ${appointmentId}`);
        }

        return result.modifiedCount;
    } catch (error: any) {
        logger.error(`[NotificationScheduler] Error cancelling reminders: ${error.message}`);
        return 0;
    }
}

/**
 * Process scheduled notifications that are due
 * Runs every minute to send notifications that are scheduled for now or past
 */
export async function processScheduledNotifications(): Promise<void> {
    try {
        const now = new Date();

        // Find pending notifications that are due (scheduled for now or earlier)
        const dueNotifications = await ScheduledNotification.find({
            status: 'pending',
            scheduledFor: { $lte: now },
            retryCount: { $lt: 3 } // Max 3 retries
        })
        .populate('customerId', '_id clerkId expoPushToken firstName email')
        .limit(100) // Process in batches
        .lean();

        if (dueNotifications.length === 0) {
            return;
        }

        logger.info(`[NotificationScheduler] Processing ${dueNotifications.length} due notifications`);

        for (const notification of dueNotifications) {
            try {
                const customer = notification.customerId as any;

                if (!customer?._id) {
                    await markNotificationFailed(notification._id, 'Customer not found');
                    continue;
                }

                // Check if appointment is still valid (not cancelled)
                const appointment = await Appointment.findById(notification.appointmentId)
                    .select('status')
                    .lean();

                if (!appointment || ['cancelled', 'completed', 'failed'].includes(appointment.status)) {
                    await ScheduledNotification.findByIdAndUpdate(notification._id, {
                        status: 'cancelled',
                        cancelledAt: now
                    });
                    continue;
                }

                // Send the notification
                const result = await sendNotificationToUser({
                    userId: customer._id.toString(),
                    title: notification.title,
                    body: notification.body,
                    type: 'reminder',
                    data: notification.data as Record<string, string>,
                    saveToDatabase: true,
                });

                if (result.success) {
                    await ScheduledNotification.findByIdAndUpdate(notification._id, {
                        status: 'sent',
                        sentAt: now
                    });
                    logger.info(`[NotificationScheduler] Sent ${notification.type} to customer ${customer.firstName || customer.email || customer._id}`);
                } else {
                    // Increment retry count
                    await ScheduledNotification.findByIdAndUpdate(notification._id, {
                        $inc: { retryCount: 1 },
                        failureReason: result.error
                    });
                }

            } catch (error: any) {
                logger.error(`[NotificationScheduler] Error processing notification ${notification._id}: ${error.message}`);
                await ScheduledNotification.findByIdAndUpdate(notification._id, {
                    $inc: { retryCount: 1 },
                    failureReason: error.message
                });
            }
        }

        // Mark notifications that exceeded retry count as failed
        await ScheduledNotification.updateMany(
            { status: 'pending', retryCount: { $gte: 3 } },
            { status: 'failed', failureReason: 'Max retries exceeded' }
        );

    } catch (error: any) {
        logger.error(`[NotificationScheduler] Error in processScheduledNotifications: ${error.message}`);
    }
}

/**
 * Mark a notification as failed
 */
async function markNotificationFailed(notificationId: any, reason: string): Promise<void> {
    await ScheduledNotification.findByIdAndUpdate(notificationId, {
        status: 'failed',
        failureReason: reason
    });
}

/**
 * Daily scheduler - runs at 12:01 AM to ensure all today's reminders are scheduled
 * This catches any appointments that might have been missed
 */
export async function scheduleDailyReminders(): Promise<void> {
    try {
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        const tomorrowEnd = new Date(now);
        tomorrowEnd.setDate(tomorrowEnd.getDate() + 2);
        tomorrowEnd.setHours(23, 59, 59, 999);

        logger.info('[NotificationScheduler] Running daily reminder scheduler...');

        // Find confirmed/pending appointments for today and tomorrow
        const appointments = await Appointment.find({
            appointmentDate: { $gte: todayStart, $lte: tomorrowEnd },
            status: { $in: ['confirmed', 'pending'] }
        })
        .populate('customerId', '_id')
        .populate({
            path: 'vendorServiceId',
            populate: [
                { path: 'vendorId', select: 'vendorName' },
                { path: 'serviceId', select: 'name' }
            ]
        })
        .lean();

        let scheduledCount = 0;

        for (const appointment of appointments) {
            // Check if reminders already exist for this appointment
            const existingReminders = await ScheduledNotification.countDocuments({
                appointmentId: appointment._id,
                status: 'pending'
            });

            // If no pending reminders exist, schedule them
            if (existingReminders === 0) {
                await scheduleAppointmentReminders(appointment as any);
                scheduledCount++;
            }
        }

        logger.info(`[NotificationScheduler] Daily scheduler completed. Checked ${appointments.length} appointments, scheduled reminders for ${scheduledCount}`);

    } catch (error: any) {
        logger.error(`[NotificationScheduler] Error in daily scheduler: ${error.message}`);
    }
}

/**
 * Start the notification scheduler
 * - Processes due notifications every minute
 * - Runs daily scheduler at 12:01 AM
 */
export function startNotificationScheduler(): void {
    logger.info('[NotificationScheduler] Starting notification scheduler...');

    // Process due notifications every minute
    setInterval(() => {
        processScheduledNotifications();
    }, 60 * 1000); // Every 1 minute

    // Schedule daily run at 12:01 AM
    scheduleDailyRun();

    // Run daily scheduler immediately on start to catch up
    scheduleDailyReminders();

    logger.info('[NotificationScheduler] Notification scheduler started (processor: every 1 min, daily: 12:01 AM)');
}

/**
 * Schedule the daily run at 12:01 AM
 */
function scheduleDailyRun(): void {
    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setDate(nextRun.getDate() + 1);
    nextRun.setHours(0, 1, 0, 0); // 12:01 AM tomorrow

    const msUntilNextRun = nextRun.getTime() - now.getTime();

    setTimeout(() => {
        scheduleDailyReminders();
        // Then run every 24 hours
        setInterval(() => {
            scheduleDailyReminders();
        }, 24 * 60 * 60 * 1000);
    }, msUntilNextRun);

    logger.info(`[NotificationScheduler] Daily scheduler will run at ${nextRun.toISOString()}`);
}

/**
 * Manually reschedule reminders for an appointment
 * Useful when appointment is rescheduled
 */
export async function rescheduleAppointmentReminders(appointmentId: string): Promise<void> {
    try {
        const appointment = await Appointment.findById(appointmentId)
            .populate('customerId', '_id')
            .populate({
                path: 'vendorServiceId',
                populate: [
                    { path: 'vendorId', select: 'vendorName' },
                    { path: 'serviceId', select: 'name' }
                ]
            })
            .lean();

        if (!appointment) {
            logger.warn(`[NotificationScheduler] Appointment ${appointmentId} not found for rescheduling`);
            return;
        }

        await scheduleAppointmentReminders(appointment as any);
        logger.info(`[NotificationScheduler] Rescheduled reminders for appointment ${appointmentId}`);

    } catch (error: any) {
        logger.error(`[NotificationScheduler] Error rescheduling reminders: ${error.message}`);
    }
}

/**
 * Sync today's scheduled notifications
 * Called when a new appointment is created to ensure immediate processing
 * This catches any appointments that might be scheduled for today
 */
export async function syncTodaySchedule(): Promise<void> {
    try {
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);

        logger.info('[NotificationScheduler] Syncing today\'s schedule...');

        // Find today's confirmed/pending appointments without scheduled reminders
        const todayAppointments = await Appointment.find({
            appointmentDate: { $gte: todayStart, $lte: todayEnd },
            status: { $in: ['confirmed', 'pending'] }
        })
        .populate('customerId', '_id')
        .populate({
            path: 'vendorServiceId',
            populate: [
                { path: 'vendorId', select: 'vendorName' },
                { path: 'serviceId', select: 'name' }
            ]
        })
        .lean();

        let scheduledCount = 0;

        for (const appointment of todayAppointments) {
            // Check if reminders already exist for this appointment
            const existingReminders = await ScheduledNotification.countDocuments({
                appointmentId: appointment._id,
                status: 'pending'
            });

            // If no pending reminders exist, schedule them
            if (existingReminders === 0) {
                await scheduleAppointmentReminders(appointment as any);
                scheduledCount++;
            }
        }

        if (scheduledCount > 0) {
            logger.info(`[NotificationScheduler] Synced today's schedule. Scheduled reminders for ${scheduledCount} appointments`);
        }

        // Also process any due notifications immediately
        await processScheduledNotifications();

    } catch (error: any) {
        logger.error(`[NotificationScheduler] Error syncing today's schedule: ${error.message}`);
    }
}

export default {
    scheduleAppointmentReminders,
    cancelAppointmentReminders,
    rescheduleAppointmentReminders,
    processScheduledNotifications,
    scheduleDailyReminders,
    syncTodaySchedule,
    startNotificationScheduler,
};
