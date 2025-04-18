import { Request, Response } from 'express';
import mongoose from 'mongoose';
import moment from 'moment';

import VendorService from '../models/vendor-service.model';
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
        const results = await VendorService.aggregate([
            // Get all vendor services for the service ID
            {
                $match: {
                    serviceId: new mongoose.Types.ObjectId(req.body.serviceId)
                }
            },
            // Lookup slots with date matching
            {
                $lookup: {
                    from: 'vendorserviceslots',
                    let: { 
                        vendorServiceId: '$_id',
                        duration: '$duration'
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$vendorServiceId', '$$vendorServiceId'] },
                                        // Ensure dates array exists
                                        { $isArray: '$dates' }
                                    ]
                                }
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
                        // Add duration to the slot
                        {
                            $addFields: {
                                duration: '$$duration'
                            }
                        },
                        // Group back to reconstruct the dates array
                        {
                            $group: {
                                _id: '$_id',
                                vendorServiceId: { $first: '$vendorServiceId' },
                                month: { $first: '$month' },
                                year: { $first: '$year' },
                                reoccurrence: { $first: '$reoccurrence' },
                                duration: { $first: '$duration' },
                                dates: { $push: '$dates' },
                                createdAt: { $first: '$createdAt' },
                                updatedAt: { $first: '$updatedAt' }
                            }
                        }
                    ],
                    as: 'slots'
                }
            },
            // Project needed fields
            {
                $project: {
                    _id: 1,
                    vendorServiceId: '$_id',
                    serviceId: 1,
                    slots: 1
                }
            }
        ]);

        let serviceSlotsByDate: any = [];
        const appointments: any = [];

        if (results.length > 0) {
            results.forEach((result: any) => {
                if (result.slots.length > 0) {
                    result.slots.forEach((slot: any) => {
                        if (slot.dates.length > 0) {
                            slot.dates.forEach((slotDate: any) => {
                                const slots = getServiceSlots(
                                    slotDate,
                                    slot.duration,
                                    appointments,
                                    slot.vendorServiceId
                                );
                                serviceSlotsByDate.push(slots);
                            });
                        }
                    })
                }
            })
        }
        serviceSlotsByDate = groupTimeSlots(serviceSlotsByDate);
        console.log("Slots: ", serviceSlotsByDate);
        res.json(serviceSlotsByDate);
    } catch (error: any) {
        res.json([]);
        throw new Error(`Error fetching vendor service slots: ${error.message}`);
    }
});