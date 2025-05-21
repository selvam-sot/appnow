import { Request, Response } from 'express';
import moment from 'moment';

import VendorServiceSlot from './../models/vendor-service-slot.model';
import { asyncHandler } from './../utils/asyncHandler.util';
import { getServiceSlots } from './../services/get-slots.service';
import { Slot } from './../interfaces/common.interface';

export const getVendorServiceSlots = asyncHandler(async (req: Request, res: Response) => {
    try {
        const payload = { 
            vendorServiceId: req.body.vendorServiceId,
            month: req.body.month,
            year: req.body.year,
        };
        let vendorServiceSlots: any = await VendorServiceSlot.find(payload);
        const appointments: any = []; // TODO
        const serviceSlotsByDate: Record<string, Slot[]> = {};
    
        if (vendorServiceSlots.length > 0) {
            vendorServiceSlots = vendorServiceSlots[0];
            for (const dateDetails of vendorServiceSlots.dates) {
                const dateStr = moment(dateDetails.date).format().substring(0, 10);
                if (!serviceSlotsByDate[dateStr]) {
                    serviceSlotsByDate[dateStr] = [];
                }
                serviceSlotsByDate[dateStr] = getServiceSlots(
                    dateDetails,
                    req.body.duration,
                    appointments
                );
            }
        }
        res.status(200).json({
            success: true,
            data: serviceSlotsByDate,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
        });
    }
});