import { Request, Response } from 'express';
import SlotLock, { ISlotLockDocument } from '../models/slot-lock.model';
import Appointment from '../models/appointment.model';
import { asyncHandler } from '../utils/asyncHandler';
import mongoose from 'mongoose';

// Lock duration in minutes
const LOCK_DURATION_MINUTES = 10;

/**
 * Lock a slot for payment processing
 * POST /api/slots/lock
 */
export const lockSlot = asyncHandler(async (req: Request, res: Response) => {
    const { vendorServiceId, date, fromTime, toTime, paymentIntentId } = req.body;
    const userId = (req as any).user?.id || (req as any).user?._id;

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: 'User authentication required'
        });
    }

    if (!vendorServiceId || !date || !fromTime || !toTime) {
        return res.status(400).json({
            success: false,
            message: 'Missing required fields: vendorServiceId, date, fromTime, toTime'
        });
    }

    const slotDate = new Date(date);
    const vendorServiceObjectId = new mongoose.Types.ObjectId(vendorServiceId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Check if slot is already booked
    const existingAppointment = await Appointment.findOne({
        vendorServiceId: vendorServiceObjectId,
        'slot.date': slotDate,
        'slot.fromTime': fromTime,
        'slot.toTime': toTime,
        status: { $nin: ['cancelled', 'rejected'] }
    });

    if (existingAppointment) {
        return res.status(409).json({
            success: false,
            message: 'This slot is already booked'
        });
    }

    // Check if slot is already locked by another user
    const existingLock = await SlotLock.findOne({
        vendorServiceId: vendorServiceObjectId,
        date: slotDate,
        fromTime,
        toTime
    });

    if (existingLock) {
        // If locked by the same user, extend the lock
        if (existingLock.lockedBy.toString() === userId) {
            existingLock.expiresAt = new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000);
            if (paymentIntentId) {
                existingLock.paymentIntentId = paymentIntentId;
            }
            await existingLock.save();

            return res.status(200).json({
                success: true,
                message: 'Lock extended',
                data: existingLock
            });
        }

        return res.status(409).json({
            success: false,
            message: 'This slot is temporarily locked by another user. Please try again shortly.',
            lockedUntil: existingLock.expiresAt
        });
    }

    // Create new lock
    const expiresAt = new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000);

    const slotLock = await SlotLock.create({
        vendorServiceId: vendorServiceObjectId,
        date: slotDate,
        fromTime,
        toTime,
        lockedBy: userObjectId,
        paymentIntentId,
        lockedAt: new Date(),
        expiresAt
    });

    res.status(201).json({
        success: true,
        message: 'Slot locked successfully',
        data: slotLock
    });
});

/**
 * Unlock a slot (release the lock)
 * POST /api/slots/unlock
 */
export const unlockSlot = asyncHandler(async (req: Request, res: Response) => {
    const { vendorServiceId, date, fromTime, toTime, paymentIntentId } = req.body;
    const userId = (req as any).user?.id || (req as any).user?._id;

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: 'User authentication required'
        });
    }

    let query: any = {};

    // Can unlock by paymentIntentId or by slot details
    if (paymentIntentId) {
        query = { paymentIntentId };
    } else if (vendorServiceId && date && fromTime && toTime) {
        query = {
            vendorServiceId: new mongoose.Types.ObjectId(vendorServiceId),
            date: new Date(date),
            fromTime,
            toTime,
            lockedBy: new mongoose.Types.ObjectId(userId)
        };
    } else {
        return res.status(400).json({
            success: false,
            message: 'Provide paymentIntentId or slot details (vendorServiceId, date, fromTime, toTime)'
        });
    }

    const result = await SlotLock.deleteOne(query);

    if (result.deletedCount === 0) {
        return res.status(404).json({
            success: false,
            message: 'No lock found to release'
        });
    }

    res.status(200).json({
        success: true,
        message: 'Slot unlocked successfully'
    });
});

/**
 * Check if a slot is locked or available
 * GET /api/slots/check
 */
export const checkSlotLock = asyncHandler(async (req: Request, res: Response) => {
    const { vendorServiceId, date, fromTime, toTime } = req.query;
    const userId = (req as any).user?.id || (req as any).user?._id;

    if (!vendorServiceId || !date || !fromTime || !toTime) {
        return res.status(400).json({
            success: false,
            message: 'Missing required query parameters: vendorServiceId, date, fromTime, toTime'
        });
    }

    const slotDate = new Date(date as string);
    const vendorServiceObjectId = new mongoose.Types.ObjectId(vendorServiceId as string);

    // Check if slot is booked
    const existingAppointment = await Appointment.findOne({
        vendorServiceId: vendorServiceObjectId,
        'slot.date': slotDate,
        'slot.fromTime': fromTime,
        'slot.toTime': toTime,
        status: { $nin: ['cancelled', 'rejected'] }
    });

    if (existingAppointment) {
        return res.status(200).json({
            success: true,
            available: false,
            reason: 'booked',
            message: 'This slot is already booked'
        });
    }

    // Check if slot is locked
    const existingLock = await SlotLock.findOne({
        vendorServiceId: vendorServiceObjectId,
        date: slotDate,
        fromTime,
        toTime
    });

    if (existingLock) {
        const isOwnLock = userId && existingLock.lockedBy.toString() === userId;

        return res.status(200).json({
            success: true,
            available: isOwnLock, // Available if it's their own lock
            locked: true,
            isOwnLock,
            lockedUntil: existingLock.expiresAt,
            message: isOwnLock
                ? 'Slot is locked by you'
                : 'Slot is temporarily locked by another user'
        });
    }

    res.status(200).json({
        success: true,
        available: true,
        locked: false,
        message: 'Slot is available'
    });
});

/**
 * Get user's active locks
 * GET /api/slots/my-locks
 */
export const getUserLocks = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id || (req as any).user?._id;

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: 'User authentication required'
        });
    }

    const locks = await SlotLock.find({
        lockedBy: new mongoose.Types.ObjectId(userId)
    }).populate('vendorServiceId', 'name');

    res.status(200).json({
        success: true,
        data: locks
    });
});

/**
 * Release all user's locks
 * DELETE /api/slots/my-locks
 */
export const releaseUserLocks = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id || (req as any).user?._id;

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: 'User authentication required'
        });
    }

    const result = await SlotLock.deleteMany({
        lockedBy: new mongoose.Types.ObjectId(userId)
    });

    res.status(200).json({
        success: true,
        message: `Released ${result.deletedCount} lock(s)`,
        deletedCount: result.deletedCount
    });
});

/**
 * Admin: Get all active locks
 * GET /api/admin/slots/locks
 */
export const getAllLocks = asyncHandler(async (req: Request, res: Response) => {
    const locks = await SlotLock.find({})
        .populate('lockedBy', 'name email')
        .populate('vendorServiceId', 'name')
        .sort({ lockedAt: -1 });

    res.status(200).json({
        success: true,
        count: locks.length,
        data: locks
    });
});

/**
 * Admin: Force release a lock
 * DELETE /api/admin/slots/locks/:lockId
 */
export const forceReleaseLock = asyncHandler(async (req: Request, res: Response) => {
    const { lockId } = req.params;

    const result = await SlotLock.findByIdAndDelete(lockId);

    if (!result) {
        return res.status(404).json({
            success: false,
            message: 'Lock not found'
        });
    }

    res.status(200).json({
        success: true,
        message: 'Lock released successfully'
    });
});

/**
 * Clean up expired locks (can be called by a cron job)
 * MongoDB TTL index handles this automatically, but this can be used for manual cleanup
 */
export const cleanupExpiredLocks = asyncHandler(async (req: Request, res: Response) => {
    const result = await SlotLock.deleteMany({
        expiresAt: { $lt: new Date() }
    });

    res.status(200).json({
        success: true,
        message: `Cleaned up ${result.deletedCount} expired lock(s)`,
        deletedCount: result.deletedCount
    });
});
