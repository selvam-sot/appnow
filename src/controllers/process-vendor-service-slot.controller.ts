import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import moment from 'moment';

import VendorService from './../models/vendor-service.model';
import VendorServiceSlot from './../models/vendor-service-slot.model';
import { AppError } from './../utils/appError.util';
import { asyncHandler } from './../utils/asyncHandler.util';
import { getServiceSlots } from './../services/get-slots.service';
import { Slot } from './../interfaces/common.interface';

export const getVendorServiceSlots = asyncHandler(async (req: Request, res: Response) => {
    let vendorServiceSlots: any = await VendorServiceSlot.find({ 
        vendorServiceId: req.body.vendorServiceId,
        month: req.body.month,
        year: req.body.year,
    });
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
    res.json(serviceSlotsByDate);
});