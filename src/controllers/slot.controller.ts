import { Request, Response } from 'express';
import mongoose from 'mongoose';
import moment from 'moment';

import VendorService from '../models/vendor-service.model';
import VendorServiceSlot from '../models/vendor-service-slot.model';
import { asyncHandler } from '../utils/asyncHandler.util';
import { getServiceSlots } from './../services/get-slots.service';

interface TimeSlot {
    start_time: string;
    end_time: string;
    availableSlots: number;
    vendorServiceId: string;
    index: number;
}

interface GroupedTimeSlot {
    start_time: string;
    end_time: string;
    availableSlots: number;
    vendorServiceIds: string[];
}

const groupTimeSlots = (timeSlots: TimeSlot[][]): GroupedTimeSlot[] => {
    // Flatten the array of arrays
    const flattenedSlots = timeSlots.flat();
    
    // Create a map to store unique time slots
    const timeSlotMap = new Map<string, GroupedTimeSlot>();
    
    flattenedSlots.forEach(slot => {
        const key = `${slot.start_time}-${slot.end_time}`;
        
        if (timeSlotMap.has(key)) {
            const existingSlot = timeSlotMap.get(key)!;
            // Add vendorServiceId if it's not already in the array
            if (!existingSlot.vendorServiceIds.includes(slot.vendorServiceId.toString())) {
            existingSlot.vendorServiceIds.push(slot.vendorServiceId.toString());
            }
        } else {
            timeSlotMap.set(key, {
            start_time: slot.start_time,
            end_time: slot.end_time,
            availableSlots: slot.availableSlots,
            vendorServiceIds: [slot.vendorServiceId.toString()]
            });
        }
    });
    
    // Convert map to array and sort by start time
    const groupedSlots = Array.from(timeSlotMap.values()).sort((a, b) => {
        return a.start_time.localeCompare(b.start_time);
    });
    
    return groupedSlots;
}

export const getServiceSlotsByDate = asyncHandler(async (req: Request, res: Response) => {
    const dt = moment(req.body.date).format('YYYY-MM-DD');
    try {
        // Step 1: Get all vendor services for the service ID
        const vendorServices = await VendorService.find({
            serviceId: new mongoose.Types.ObjectId(req.body.serviceId)
        });
        
        let serviceSlotsByDate: any = [];
        const appointments: any = [];
        
        // Step 2: Process each vendor service
        for (const vendorService of vendorServices) {
            // Step 3: For each vendor service, find matching slots
            // This replaces the $lookup with let
            const slots = await VendorServiceSlot.aggregate([
                // Match slots for this vendor service
                {
                    $match: {
                        vendorServiceId: vendorService._id
                    }
                },
                // Unwind dates array to match specific date
                {
                    $unwind: '$dates'
                },
                // Match the specific date
                {
                    $match: {
                        'dates.date': new Date(dt)
                    }
                },
                // Add duration field from vendor service
                {
                    $addFields: {
                        duration: vendorService.duration
                    }
                }
            ]);
            
            // Step 4: Process the slots (similar to your original code)
            if (slots.length > 0) {
                slots.forEach((slot: any) => {
                    const slots = getServiceSlots(
                        slot.dates,
                        slot.duration,
                        appointments,
                        slot.vendorServiceId
                    );
                    serviceSlotsByDate.push(slots);
                });
            }
        }
        
        // Group and return results (unchanged)
        serviceSlotsByDate = groupTimeSlots(serviceSlotsByDate);
        res.status(200).json({
            success: true,
            data: serviceSlotsByDate,
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
        });
    }
});

/**
 * Find nearby dates that have available slots for a given serviceId.
 * Logic:
 *   - At most 1 date before the selected date (immediate previous with slots, >= today)
 *   - Fill remaining after dates to reach ~10 total
 *   - If no before date, return 10 after dates
 *
 * Examples (today = Feb 14, selected = Feb 16, no slot):
 *   - Feb 15 has slots → [Feb 15, Feb 17, Feb 18, ... up to 10 total]
 *   - Feb 15 has no slots → [Feb 17, Feb 18, ... up to 10 total]
 */
export const getNearbyAvailableDates = asyncHandler(async (req: Request, res: Response) => {
    const { serviceId, date } = req.body;
    const targetDate = moment(date).startOf('day');
    const today = moment().startOf('day');
    const totalNeeded = 10;

    try {
        // Step 1: Find all vendor services for this service
        const vendorServices = await VendorService.find({
            serviceId: new mongoose.Types.ObjectId(serviceId)
        });

        if (vendorServices.length === 0) {
            res.status(200).json({ success: true, data: [] });
            return;
        }

        const vendorServiceIds = vendorServices.map(vs => vs._id);

        // Step 2: Search window — 1 day before (clamped to today) to 60 days after
        const searchStart = moment.max(today, moment(targetDate).subtract(1, 'day'));
        const searchEnd = moment(targetDate).add(60, 'days');

        // Step 3: Build month/year conditions covering the search range
        const monthYearConditions = [];
        const cursor = moment(searchStart).startOf('month');
        while (cursor.isSameOrBefore(searchEnd)) {
            monthYearConditions.push({
                month: cursor.month() + 1,
                year: cursor.year()
            });
            cursor.add(1, 'month');
        }

        // Step 4: Query VendorServiceSlot for all vendor services in the range
        const allSlotDocs = await VendorServiceSlot.find({
            vendorServiceId: { $in: vendorServiceIds },
            $or: monthYearConditions,
        }).lean();

        // Step 5: Collect unique dates that have timing entries
        const datesWithSlots = new Set<string>();

        for (const slotDoc of allSlotDocs) {
            for (const dateDetails of (slotDoc as any).dates) {
                const dateObj = moment(dateDetails.date).startOf('day');
                if (dateObj.isSameOrAfter(searchStart) &&
                    dateObj.isSameOrBefore(searchEnd) &&
                    dateObj.isSameOrAfter(today) &&
                    !dateObj.isSame(targetDate, 'day') &&
                    dateDetails.timings && dateDetails.timings.length > 0) {
                    datesWithSlots.add(dateObj.format('YYYY-MM-DD'));
                }
            }
        }

        // Step 6: Sort, pick 1 before + fill after to reach totalNeeded
        const sortedDates = Array.from(datesWithSlots).sort();

        // At most 1 date before (the closest one before selected date)
        const beforeDates = sortedDates.filter(d => moment(d).isBefore(targetDate));
        const beforeDate = beforeDates.length > 0 ? [beforeDates[beforeDates.length - 1]] : [];

        // After dates: fill remaining to reach totalNeeded
        const afterNeeded = totalNeeded - beforeDate.length;
        const afterDates = sortedDates
            .filter(d => moment(d).isAfter(targetDate))
            .slice(0, afterNeeded);

        const nearbyDates = [...beforeDate, ...afterDates];

        res.status(200).json({
            success: true,
            data: nearbyDates,
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
        });
    }
});