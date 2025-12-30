import { Request, Response } from 'express';
import moment from 'moment';

import VendorServiceSlot from './../models/vendor-service-slot.model';
import { asyncHandler } from './../utils/asyncHandler.util';
import { getServiceSlots } from './../services/get-slots.service';
import { Slot } from './../interfaces/common.interface';

export const getVendorServiceSlots = asyncHandler(async (req: Request, res: Response) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const payload = {
            vendorServiceId: req.body.vendorServiceId,
            month: req.body.month,
            year: req.body.year,
            dates: {
                $elemMatch: {
                    date: {
                        $gte: today
                    }
                }
            }
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

// Get next 15 active days with slots starting from a given date
export const getVendorServiceSlotsByDate = asyncHandler(async (req: Request, res: Response) => {
    try {
        const { vendorServiceId, date, duration } = req.body;
        const startDate = date ? new Date(date) : new Date();
        startDate.setHours(0, 0, 0, 0);

        const activeDaysNeeded = 15;
        const serviceSlotsByDate: Record<string, Slot[]> = {};
        const appointments: any = []; // TODO

        // Build month/year conditions for next 3 months in a single query
        const monthYearConditions = [];
        for (let i = 0; i < 3; i++) {
            const searchDate = new Date(startDate);
            searchDate.setMonth(searchDate.getMonth() + i);
            monthYearConditions.push({
                month: searchDate.getMonth() + 1,
                year: searchDate.getFullYear()
            });
        }

        // Single query to fetch all months at once
        const vendorServiceSlots: any = await VendorServiceSlot.find({
            vendorServiceId,
            $or: monthYearConditions,
            dates: {
                $elemMatch: {
                    date: { $gte: startDate }
                }
            }
        }).lean();

        // Collect all dates from all month documents
        const allDates: any[] = [];
        for (const slotDoc of vendorServiceSlots) {
            for (const dateDetails of slotDoc.dates) {
                const dateObj = new Date(dateDetails.date);
                if (dateObj >= startDate) {
                    allDates.push(dateDetails);
                }
            }
        }

        // Sort all dates chronologically
        allDates.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Process dates and pick first 15 active days
        let activeDaysFound = 0;
        for (const dateDetails of allDates) {
            if (activeDaysFound >= activeDaysNeeded) break;

            const dateStr = moment(dateDetails.date).format().substring(0, 10);

            // Skip if already processed
            if (serviceSlotsByDate[dateStr]) continue;

            // Get slots for this date
            const slots = getServiceSlots(dateDetails, duration, appointments);

            // Only count as active day if there are available slots
            if (slots.length > 0) {
                serviceSlotsByDate[dateStr] = slots;
                activeDaysFound++;
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