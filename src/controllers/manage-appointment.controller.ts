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