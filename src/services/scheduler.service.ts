/**
 * Scheduler Service
 * Handles scheduled tasks like appointment reminders
 */

import Appointment from '../models/appointment.model';
import VendorService from '../models/vendor-service.model';
import { sendAppointmentReminderNotification } from './pushNotification.service';
import logger from '../config/logger';

// Track sent reminders to avoid duplicates
const sentReminders = new Map<string, Date>();

// Clean up old entries every hour
setInterval(() => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    sentReminders.forEach((sentAt, key) => {
        if (sentAt < oneHourAgo) {
            sentReminders.delete(key);
        }
    });
}, 60 * 60 * 1000);

/**
 * Check and send appointment reminders
 * Called periodically by the scheduler
 */
export async function checkAndSendReminders(): Promise<void> {
    try {
        const now = new Date();

        // Find appointments in the next 24 hours that are confirmed
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        // Get appointments for reminder (24 hours before)
        const appointments24h = await findUpcomingAppointments(
            new Date(now.getTime() + 23 * 60 * 60 * 1000),
            new Date(now.getTime() + 25 * 60 * 60 * 1000)
        );

        // Get appointments for reminder (1 hour before)
        const appointments1h = await findUpcomingAppointments(
            new Date(now.getTime() + 55 * 60 * 1000),
            new Date(now.getTime() + 65 * 60 * 1000)
        );

        // Send 24-hour reminders
        for (const appointment of appointments24h) {
            const reminderKey = `${appointment._id}-24h`;
            if (!sentReminders.has(reminderKey)) {
                await sendReminderForAppointment(appointment, '24h');
                sentReminders.set(reminderKey, now);
            }
        }

        // Send 1-hour reminders
        for (const appointment of appointments1h) {
            const reminderKey = `${appointment._id}-1h`;
            if (!sentReminders.has(reminderKey)) {
                await sendReminderForAppointment(appointment, '1h');
                sentReminders.set(reminderKey, now);
            }
        }

        logger.info(`Reminder check completed. 24h: ${appointments24h.length}, 1h: ${appointments1h.length}`);
    } catch (error: any) {
        logger.error(`Error in reminder scheduler: ${error.message}`);
    }
}

/**
 * Find upcoming appointments within a time window
 */
async function findUpcomingAppointments(startTime: Date, endTime: Date): Promise<any[]> {
    try {
        // Get today's date at start
        const startDate = new Date(startTime);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(endTime);
        endDate.setHours(23, 59, 59, 999);

        const appointments = await Appointment.find({
            appointmentDate: {
                $gte: startDate,
                $lte: endDate
            },
            status: { $in: ['confirmed', 'pending'] }
        })
        .populate('customerId', '_id clerkId firstName lastName expoPushToken')
        .populate({
            path: 'vendorServiceId',
            populate: [
                { path: 'vendorId', select: 'vendorName' },
                { path: 'serviceId', select: 'name' }
            ]
        })
        .lean();

        // Filter by time
        return appointments.filter(apt => {
            if (!apt.startTime) return false;

            const [hours, minutes] = apt.startTime.split(':').map(Number);
            const aptDateTime = new Date(apt.appointmentDate);
            aptDateTime.setHours(hours, minutes, 0, 0);

            return aptDateTime >= startTime && aptDateTime <= endTime;
        });
    } catch (error: any) {
        logger.error(`Error finding upcoming appointments: ${error.message}`);
        return [];
    }
}

/**
 * Send reminder notification for a specific appointment
 */
async function sendReminderForAppointment(appointment: any, reminderType: '24h' | '1h'): Promise<void> {
    try {
        const customerId = appointment.customerId?._id?.toString();
        if (!customerId) {
            logger.warn(`No customer ID for appointment ${appointment._id}`);
            return;
        }

        const vendorService = appointment.vendorServiceId;
        const serviceName = vendorService?.serviceId?.name || vendorService?.name || 'your service';
        const vendorName = vendorService?.vendorId?.vendorName;

        const appointmentDate = new Date(appointment.appointmentDate);
        const formattedDate = appointmentDate.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        });

        const result = await sendAppointmentReminderNotification(customerId, {
            serviceName,
            vendorName,
            date: formattedDate,
            time: appointment.startTime,
            appointmentId: appointment._id.toString(),
        });

        if (result.success) {
            logger.info(`${reminderType} reminder sent for appointment ${appointment._id}`);
        } else {
            logger.warn(`Failed to send ${reminderType} reminder for appointment ${appointment._id}: ${result.error}`);
        }
    } catch (error: any) {
        logger.error(`Error sending reminder for appointment ${appointment._id}: ${error.message}`);
    }
}

/**
 * Start the reminder scheduler
 * Runs every 5 minutes
 */
export function startReminderScheduler(): void {
    logger.info('Starting appointment reminder scheduler...');

    // Run immediately on start
    checkAndSendReminders();

    // Then run every 5 minutes
    setInterval(() => {
        checkAndSendReminders();
    }, 5 * 60 * 1000);

    logger.info('Appointment reminder scheduler started (runs every 5 minutes)');
}

/**
 * Manually trigger a reminder for a specific appointment
 * Useful for testing or admin-triggered reminders
 */
export async function sendManualReminder(appointmentId: string): Promise<{ success: boolean; message: string }> {
    try {
        const appointment = await Appointment.findById(appointmentId)
            .populate('customerId', '_id clerkId firstName lastName expoPushToken')
            .populate({
                path: 'vendorServiceId',
                populate: [
                    { path: 'vendorId', select: 'vendorName' },
                    { path: 'serviceId', select: 'name' }
                ]
            })
            .lean();

        if (!appointment) {
            return { success: false, message: 'Appointment not found' };
        }

        if (appointment.status === 'cancelled') {
            return { success: false, message: 'Cannot send reminder for cancelled appointment' };
        }

        await sendReminderForAppointment(appointment, '1h');
        return { success: true, message: 'Reminder sent successfully' };
    } catch (error: any) {
        logger.error(`Error sending manual reminder: ${error.message}`);
        return { success: false, message: error.message };
    }
}

export default {
    startReminderScheduler,
    checkAndSendReminders,
    sendManualReminder,
};
