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