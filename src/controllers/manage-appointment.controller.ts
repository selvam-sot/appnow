import { Request, Response } from 'express';
import mongoose from 'mongoose';

import Appointment from './../models/appointment.model';
import VendorService from './../models/vendor-service.model';
import { AppError } from './../utils/appError.util';
import { asyncHandler } from './../utils/asyncHandler.util';

export const getAppointments = asyncHandler(async (req: Request, res: Response) => {
    const appointments = await Appointment.find(req.body).populate('customerId').populate('vendorServiceId');
    res.json(appointments);
});

export const getServiceSlots = asyncHandler(async (req: Request, res: Response) => {
    try {
        const result = await VendorService.aggregate([
            {
                $match: {
                    serviceId: new mongoose.Types.ObjectId(req.body.serviceId)
                }
            },
            {
            $lookup: {
                from: 'vendorserviceslots',
                let: { vendorServiceId: '$_id' },
                pipeline: [
                {
                    $match: {
                        $expr: {
                            $and: [
                            { $eq: ['$vendorServiceId', '$$vendorServiceId'] },
                            { $eq: ['$month', req.body.month] },
                            { $eq: ['$year', req.body.year] }
                            ]
                        }
                        }
                    }
                    ],
                    as: 'slots'
                }
            },
            // Only include records that have matching slots
            {
                $match: {
                    'slots.0': { $exists: true }
                }
            },
            // Optional: Reshape the output if needed
            {
                $project: {
                    _id: 1,
                    vendorServiceId: '$_id',
                    serviceId: 1,
                    slots: 1
                }
            }
        ]);
        res.status(200).json({
            success: true,
            data: result,
        });

        res.json(result);
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
        });
    }
    
});

export const getServiceSlots2 = asyncHandler(async (req: Request, res: Response) => {
    const vendorService = await VendorService.findById(req.params.id);
    if (!vendorService) {
        throw new AppError('Vendor Service not found', 404);
    }
    res.json([]);
});

/**
 * Get appointment by ID (Admin)
 */
export const getAppointmentById = asyncHandler(async (req: Request, res: Response) => {
    const appointment = await Appointment.findById(req.params.id)
        .populate('customerId', 'firstName lastName email phone')
        .populate({
            path: 'vendorServiceId',
            populate: [
                { path: 'vendorId', select: 'vendorName email phone' },
                { path: 'serviceId', select: 'name' }
            ]
        });

    if (!appointment) {
        throw new AppError('Appointment not found', 404);
    }

    res.status(200).json({
        success: true,
        data: appointment
    });
});

/**
 * Update appointment status (Admin)
 */
export const updateAppointmentStatus = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, reason } = req.body;

    const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed', 'missed', 'failed'];
    if (!validStatuses.includes(status)) {
        throw new AppError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
    }

    const appointment = await Appointment.findById(id);
    if (!appointment) {
        throw new AppError('Appointment not found', 404);
    }

    // For missed/failed, require a reason
    if (['missed', 'failed'].includes(status) && (!reason || reason.trim().length < 5)) {
        throw new AppError('Please provide a reason (at least 5 characters) for missed/failed status', 400);
    }

    appointment.status = status;
    (appointment as any).statusChangedBy = 'admin';

    if (status === 'completed') {
        (appointment as any).completedAt = new Date();
    }

    if (['missed', 'failed'].includes(status)) {
        (appointment as any).statusReason = reason.trim();
    }

    await appointment.save();

    res.status(200).json({
        success: true,
        message: `Appointment status updated to ${status}`,
        data: appointment
    });
});