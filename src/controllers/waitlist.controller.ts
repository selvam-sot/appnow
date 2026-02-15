import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Waitlist from '../models/waitlist.model';
import User from '../models/user.model';
import VendorService from '../models/vendor-service.model';
import { AppError } from '../utils/appError.util';
import { asyncHandler } from '../utils/asyncHandler.util';
import { sendNotificationToUser } from '../services/push-notification.service';
import logger from '../config/logger';

/**
 * POST /join
 * Join the waitlist for a fully booked slot.
 * Body: { clerkId, vendorServiceId, preferredDate, preferredTime? }
 */
export const joinWaitlist = asyncHandler(async (req: Request, res: Response) => {
    const { clerkId, vendorServiceId, preferredDate, preferredTime } = req.body;

    if (!clerkId || !vendorServiceId || !preferredDate) {
        throw new AppError('clerkId, vendorServiceId, and preferredDate are required', 400);
    }

    // Look up the user by clerkId to get their MongoDB _id
    const user = await User.findOne({ clerkId }).select('_id').lean();
    if (!user) {
        throw new AppError('User not found', 404);
    }

    // Check for duplicate: same user, same service, same date, still active
    const existing = await Waitlist.findOne({
        customerId: user._id,
        vendorServiceId: new mongoose.Types.ObjectId(vendorServiceId),
        preferredDate,
        status: 'active',
    });

    if (existing) {
        return res.status(409).json({
            success: false,
            message: 'You are already on the waitlist for this service on this date.',
            data: existing,
        });
    }

    const entry = await Waitlist.create({
        customerId: user._id,
        clerkId,
        vendorServiceId: new mongoose.Types.ObjectId(vendorServiceId),
        preferredDate,
        preferredTime: preferredTime || undefined,
    });

    logger.info(`User ${clerkId} joined waitlist for service ${vendorServiceId} on ${preferredDate}`);

    res.status(201).json({
        success: true,
        message: 'Successfully joined the waitlist.',
        data: entry,
    });
});

/**
 * DELETE /:id
 * Leave / remove a waitlist entry by its _id.
 */
export const leaveWaitlist = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const entry = await Waitlist.findByIdAndDelete(id);

    if (!entry) {
        throw new AppError('Waitlist entry not found', 404);
    }

    logger.info(`Waitlist entry ${id} removed`);

    res.status(200).json({
        success: true,
        message: 'Successfully removed from the waitlist.',
    });
});

/**
 * GET /my-waitlist/:clerkId
 * Returns all active waitlist entries for a user, populated with vendor service details.
 */
export const getMyWaitlist = asyncHandler(async (req: Request, res: Response) => {
    const { clerkId } = req.params;

    if (!clerkId) {
        throw new AppError('clerkId is required', 400);
    }

    const entries = await Waitlist.find({ clerkId, status: 'active' })
        .populate({
            path: 'vendorServiceId',
            select: 'name image price duration',
            populate: {
                path: 'vendorId',
                select: 'vendorName name',
            },
        })
        .sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        count: entries.length,
        data: entries,
    });
});

/**
 * Internal function (not a route handler).
 * When a slot becomes available (e.g., after cancellation), find all active
 * waitlist entries matching the vendorServiceId + date, send push notifications,
 * and mark them as 'notified'.
 */
export async function notifyWaitlistedUsers(
    vendorServiceId: string,
    appointmentDate: Date | string
): Promise<void> {
    try {
        // Normalize the date to YYYY-MM-DD string for matching against preferredDate
        const dateObj = typeof appointmentDate === 'string'
            ? new Date(appointmentDate)
            : appointmentDate;
        const dateStr = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD

        // Find all active waitlist entries for this service + date
        const entries = await Waitlist.find({
            vendorServiceId: new mongoose.Types.ObjectId(vendorServiceId),
            preferredDate: dateStr,
            status: 'active',
        });

        if (entries.length === 0) {
            return;
        }

        // Get vendor service details for the notification message
        const vendorService = await VendorService.findById(vendorServiceId)
            .populate('vendorId', 'vendorName name')
            .populate('serviceId', 'name')
            .lean();

        const serviceName = vendorService
            ? (vendorService as any).name || (vendorService.serviceId as any)?.name || 'Service'
            : 'Service';
        const vendorName = vendorService
            ? (vendorService.vendorId as any)?.vendorName || (vendorService.vendorId as any)?.name || ''
            : '';

        const formattedDate = dateObj.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        });

        // Notify each waitlisted user
        for (const entry of entries) {
            try {
                await sendNotificationToUser({
                    userId: entry.customerId.toString(),
                    title: 'Slot Available!',
                    body: vendorName
                        ? `A slot for ${serviceName} with ${vendorName} on ${formattedDate} is now available. Book now before it fills up!`
                        : `A slot for ${serviceName} on ${formattedDate} is now available. Book now before it fills up!`,
                    type: 'appointment',
                    data: {
                        vendorServiceId,
                        preferredDate: dateStr,
                        waitlistId: entry._id.toString(),
                        action: 'waitlist_slot_available',
                    },
                    saveToDatabase: true,
                });

                // Mark entry as notified
                entry.status = 'notified';
                entry.notifiedAt = new Date();
                await entry.save();

                logger.info(`Waitlist notification sent to user ${entry.clerkId} for service ${vendorServiceId} on ${dateStr}`);
            } catch (notifyError: any) {
                logger.error(`Failed to notify waitlisted user ${entry.clerkId}: ${notifyError.message}`);
            }
        }

        logger.info(`Notified ${entries.length} waitlisted user(s) for service ${vendorServiceId} on ${dateStr}`);
    } catch (error: any) {
        logger.error(`Error in notifyWaitlistedUsers: ${error.message}`);
    }
}
