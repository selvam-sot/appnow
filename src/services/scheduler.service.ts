/**
 * Scheduler Service
 * Handles scheduled tasks like appointment reminders
 * Uses database tracking to persist reminder status through server restarts
 */

import Appointment from '../models/appointment.model';
import VendorService from '../models/vendor-service.model';
import { sendAppointmentReminderNotification } from './pushNotification.service';
import logger from '../config/logger';

// Track last auto-complete run to avoid running too frequently
let lastAutoCompleteRun = new Date(0);

/**
 * Check and send appointment reminders
 * Uses database fields to track sent reminders (persists through restarts)
 */
export async function checkAndSendReminders(): Promise<void> {
    try {
        const now = new Date();

        // Send 24-hour reminders
        await send24HourReminders(now);

        // Send 1-hour reminders
        await send1HourReminders(now);

    } catch (error: any) {
        logger.error(`Error in reminder scheduler: ${error.message}`);
    }
}

/**
 * Send 24-hour reminders for appointments happening in 23-25 hours
 */
async function send24HourReminders(now: Date): Promise<void> {
    try {
        const startWindow = new Date(now.getTime() + 23 * 60 * 60 * 1000);
        const endWindow = new Date(now.getTime() + 25 * 60 * 60 * 1000);

        // Find appointments that:
        // 1. Are in the 24-hour window
        // 2. Are confirmed or pending
        // 3. Haven't received 24h reminder yet
        const appointments = await findAppointmentsForReminder(startWindow, endWindow, 'reminder24hSentAt');

        let sentCount = 0;
        for (const appointment of appointments) {
            const sent = await sendReminderForAppointment(appointment, '24h');
            if (sent) {
                // Update database to mark reminder as sent
                await Appointment.findByIdAndUpdate(appointment._id, {
                    reminder24hSentAt: now
                });
                sentCount++;
            }
        }

        if (sentCount > 0) {
            logger.info(`Sent ${sentCount} 24-hour reminders`);
        }
    } catch (error: any) {
        logger.error(`Error sending 24h reminders: ${error.message}`);
    }
}

/**
 * Send 1-hour reminders for appointments happening in 55-65 minutes
 */
async function send1HourReminders(now: Date): Promise<void> {
    try {
        const startWindow = new Date(now.getTime() + 55 * 60 * 1000);
        const endWindow = new Date(now.getTime() + 65 * 60 * 1000);

        // Find appointments that:
        // 1. Are in the 1-hour window
        // 2. Are confirmed or pending
        // 3. Haven't received 1h reminder yet
        const appointments = await findAppointmentsForReminder(startWindow, endWindow, 'reminder1hSentAt');

        let sentCount = 0;
        for (const appointment of appointments) {
            const sent = await sendReminderForAppointment(appointment, '1h');
            if (sent) {
                // Update database to mark reminder as sent
                await Appointment.findByIdAndUpdate(appointment._id, {
                    reminder1hSentAt: now
                });
                sentCount++;
            }
        }

        if (sentCount > 0) {
            logger.info(`Sent ${sentCount} 1-hour reminders`);
        }
    } catch (error: any) {
        logger.error(`Error sending 1h reminders: ${error.message}`);
    }
}

/**
 * Find appointments for reminder within a time window
 * @param startTime Window start time
 * @param endTime Window end time
 * @param reminderField Field to check if reminder was already sent
 */
async function findAppointmentsForReminder(
    startTime: Date,
    endTime: Date,
    reminderField: 'reminder24hSentAt' | 'reminder1hSentAt'
): Promise<any[]> {
    try {
        // Get date range for the query
        const startDate = new Date(startTime);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(endTime);
        endDate.setHours(23, 59, 59, 999);

        // Build query to find appointments that haven't received this reminder
        const query: any = {
            appointmentDate: {
                $gte: startDate,
                $lte: endDate
            },
            status: { $in: ['confirmed', 'pending'] },
            [reminderField]: { $exists: false } // Not sent yet
        };

        const appointments = await Appointment.find(query)
            .populate('customerId', '_id clerkId firstName lastName expoPushToken email')
            .populate({
                path: 'vendorServiceId',
                populate: [
                    { path: 'vendorId', select: 'vendorName' },
                    { path: 'serviceId', select: 'name' }
                ]
            })
            .lean();

        // Filter by exact time window
        return appointments.filter(apt => {
            if (!apt.startTime) return false;

            const [hours, minutes] = apt.startTime.split(':').map(Number);
            const aptDateTime = new Date(apt.appointmentDate);
            aptDateTime.setHours(hours, minutes, 0, 0);

            return aptDateTime >= startTime && aptDateTime <= endTime;
        });
    } catch (error: any) {
        logger.error(`Error finding appointments for reminder: ${error.message}`);
        return [];
    }
}

/**
 * Send reminder notification for a specific appointment
 * @returns true if sent successfully, false otherwise
 */
async function sendReminderForAppointment(appointment: any, reminderType: '24h' | '1h'): Promise<boolean> {
    try {
        const customer = appointment.customerId;
        if (!customer?._id) {
            logger.warn(`No customer ID for appointment ${appointment._id}`);
            return false;
        }

        const customerId = customer._id.toString();
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
            reminderType, // Include type so notification can be customized
        });

        if (result.success) {
            logger.info(`${reminderType} reminder sent for appointment ${appointment._id} to customer ${customer.firstName || customer.email || customerId}`);
            return true;
        } else {
            logger.warn(`Failed to send ${reminderType} reminder for appointment ${appointment._id}: ${result.error}`);
            return false;
        }
    } catch (error: any) {
        logger.error(`Error sending reminder for appointment ${appointment._id}: ${error.message}`);
        return false;
    }
}

/**
 * Auto-complete past confirmed appointments
 * Runs periodically to mark appointments as completed when their end time has passed
 */
export async function autoCompleteAppointments(): Promise<void> {
    try {
        const now = new Date();

        // Only run every 15 minutes to avoid excessive DB operations
        const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
        if (lastAutoCompleteRun > fifteenMinutesAgo) {
            return;
        }
        lastAutoCompleteRun = now;

        logger.info('Running auto-complete check for past appointments...');

        // Find confirmed appointments from past days (not today, to give buffer)
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(23, 59, 59, 999);

        // Find all confirmed appointments that ended before yesterday
        const pastConfirmedAppointments = await Appointment.find({
            appointmentDate: { $lte: yesterday },
            status: 'confirmed'
        }).lean();

        // Also check for confirmed appointments from today where end time has passed
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);

        const todayAppointments = await Appointment.find({
            appointmentDate: { $gte: todayStart, $lte: todayEnd },
            status: 'confirmed'
        }).lean();

        // Filter today's appointments where end time has passed (with 30 min buffer)
        const bufferMinutes = 30;
        const currentTimeWithBuffer = new Date(now.getTime() - bufferMinutes * 60 * 1000);
        const currentHour = currentTimeWithBuffer.getHours();
        const currentMinute = currentTimeWithBuffer.getMinutes();
        const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

        const todayPastAppointments = todayAppointments.filter(apt => {
            if (!apt.endTime) return false;
            return apt.endTime <= currentTimeStr;
        });

        // Combine all appointments to auto-complete
        const appointmentsToComplete = [...pastConfirmedAppointments, ...todayPastAppointments];

        if (appointmentsToComplete.length === 0) {
            logger.info('No appointments to auto-complete');
            return;
        }

        // Update all found appointments to completed
        const appointmentIds = appointmentsToComplete.map(apt => apt._id);

        const result = await Appointment.updateMany(
            { _id: { $in: appointmentIds } },
            {
                $set: {
                    status: 'completed',
                    completedAt: now,
                    statusChangedBy: 'auto'
                }
            }
        );

        logger.info(`Auto-completed ${result.modifiedCount} appointments`);

    } catch (error: any) {
        logger.error(`Error in auto-complete scheduler: ${error.message}`);
    }
}

/**
 * Start the reminder scheduler
 * Runs every 5 minutes to check for reminders
 */
export function startReminderScheduler(): void {
    logger.info('Starting appointment scheduler...');

    // Run immediately on start
    checkAndSendReminders();
    autoCompleteAppointments();

    // Then run every 5 minutes for reminders
    setInterval(() => {
        checkAndSendReminders();
        // Auto-complete has its own internal throttle (every 15 min)
        autoCompleteAppointments();
    }, 5 * 60 * 1000);

    logger.info('Appointment scheduler started (reminders: every 5 min, auto-complete: every 15 min)');
}

/**
 * Manually trigger a reminder for a specific appointment
 * Useful for testing or admin-triggered reminders
 */
export async function sendManualReminder(appointmentId: string): Promise<{ success: boolean; message: string }> {
    try {
        const appointment = await Appointment.findById(appointmentId)
            .populate('customerId', '_id clerkId firstName lastName expoPushToken email')
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

        const sent = await sendReminderForAppointment(appointment, '1h');
        if (sent) {
            return { success: true, message: 'Reminder sent successfully' };
        } else {
            return { success: false, message: 'Failed to send reminder - check if customer has push token' };
        }
    } catch (error: any) {
        logger.error(`Error sending manual reminder: ${error.message}`);
        return { success: false, message: error.message };
    }
}

export default {
    startReminderScheduler,
    checkAndSendReminders,
    autoCompleteAppointments,
    sendManualReminder,
};
