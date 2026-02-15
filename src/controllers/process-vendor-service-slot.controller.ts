import { Request, Response } from 'express';
import moment from 'moment';

import VendorServiceSlot from './../models/vendor-service-slot.model';
import Appointment from './../models/appointment.model';
import { asyncHandler } from './../utils/asyncHandler.util';
import { getServiceSlots } from './../services/get-slots.service';
import { Slot, Appointment as AppointmentInterface } from './../interfaces/common.interface';

/**
 * Fetch and group appointments by date for a vendor service
 * Returns a Record where key is date string (YYYY-MM-DD) and value is array of appointments
 * Each appointment entry tracks start_time, end_time, and count of bookings for that slot
 */
const getAppointmentsByDate = async (
    vendorServiceId: string,
    startDate: Date,
    endDate: Date
): Promise<Record<string, AppointmentInterface[]>> => {
    const appointments = await Appointment.find({
        vendorServiceId,
        appointmentDate: {
            $gte: startDate,
            $lte: endDate
        },
        status: { $nin: ['cancelled'] } // Exclude cancelled appointments
    }).lean();

    // Group appointments by date and time slot
    const appointmentsByDate: Record<string, AppointmentInterface[]> = {};

    for (const appointment of appointments) {
        const dateStr = moment(appointment.appointmentDate).format('YYYY-MM-DD');

        if (!appointmentsByDate[dateStr]) {
            appointmentsByDate[dateStr] = [];
        }

        // Find existing entry for same time slot or create new one
        const existingEntry = appointmentsByDate[dateStr].find(
            (a) => a.start_time === appointment.startTime && a.end_time === appointment.endTime
        );

        if (existingEntry) {
            // Increment count for same time slot
            existingEntry.appointments += 1;
        } else {
            // Add new time slot entry
            appointmentsByDate[dateStr].push({
                start_time: appointment.startTime,
                end_time: appointment.endTime,
                appointments: 1
            });
        }
    }

    return appointmentsByDate;
};

export const getVendorServiceSlots = asyncHandler(async (req: Request, res: Response) => {
    try {
        const { vendorServiceId, month, year, duration } = req.body;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const payload = {
            vendorServiceId,
            month,
            year,
            dates: {
                $elemMatch: {
                    date: {
                        $gte: today
                    }
                }
            }
        };

        let vendorServiceSlots: any = await VendorServiceSlot.find(payload);
        const serviceSlotsByDate: Record<string, Slot[]> = {};

        if (vendorServiceSlots.length > 0) {
            vendorServiceSlots = vendorServiceSlots[0];

            // Calculate date range for appointments query
            const dates = vendorServiceSlots.dates.filter((d: any) => new Date(d.date) >= today);
            if (dates.length > 0) {
                const startDate = new Date(Math.min(...dates.map((d: any) => new Date(d.date).getTime())));
                const endDate = new Date(Math.max(...dates.map((d: any) => new Date(d.date).getTime())));
                endDate.setHours(23, 59, 59, 999);

                // Fetch appointments for the date range
                const appointments = await getAppointmentsByDate(vendorServiceId, startDate, endDate);

                for (const dateDetails of dates) {
                    const dateStr = moment(dateDetails.date).format().substring(0, 10);
                    if (!serviceSlotsByDate[dateStr]) {
                        serviceSlotsByDate[dateStr] = [];
                    }
                    serviceSlotsByDate[dateStr] = getServiceSlots(
                        dateDetails,
                        duration,
                        appointments
                    );
                }
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

/**
 * Check if a specific slot is still available before payment
 * Returns slot availability and alternative slots if not available
 */
export const checkSlotAvailability = asyncHandler(async (req: Request, res: Response) => {
    try {
        const { vendorServiceId, date, startTime, endTime, duration } = req.body;

        if (!vendorServiceId || !date || !startTime || !endTime) {
            res.status(400).json({
                success: false,
                error: 'Missing required fields',
                message: 'vendorServiceId, date, startTime, and endTime are required',
            });
            return;
        }

        const checkDate = new Date(date);
        checkDate.setHours(0, 0, 0, 0);

        const dateStr = moment(checkDate).format('YYYY-MM-DD');

        // Get the slot configuration for this date
        const vendorServiceSlot = await VendorServiceSlot.findOne({
            vendorServiceId,
            month: checkDate.getMonth() + 1,
            year: checkDate.getFullYear(),
            'dates.date': checkDate
        }).lean();

        if (!vendorServiceSlot) {
            res.status(200).json({
                success: true,
                available: false,
                message: 'No slots configured for this date',
                alternativeSlots: [],
            });
            return;
        }

        // Find the specific date details
        const dateDetails = (vendorServiceSlot as any).dates.find((d: any) => {
            const dDate = moment(d.date).format('YYYY-MM-DD');
            return dDate === dateStr;
        });

        if (!dateDetails) {
            res.status(200).json({
                success: true,
                available: false,
                message: 'No slots configured for this date',
                alternativeSlots: [],
            });
            return;
        }

        // Get appointments for this date
        const appointments = await getAppointmentsByDate(
            vendorServiceId,
            checkDate,
            new Date(checkDate.getTime() + 24 * 60 * 60 * 1000)
        );

        // Check if the specific slot is available
        const slotStartTs = new Date(`${dateStr} ${startTime}`).getTime();
        const slotEndTs = new Date(`${dateStr} ${endTime}`).getTime();

        let availableCount = dateDetails.reoccurrence;

        if (appointments[dateStr]) {
            for (const appointment of appointments[dateStr]) {
                const appointmentStartTs = new Date(`${dateStr} ${appointment.start_time}`).getTime();
                const appointmentEndTs = new Date(`${dateStr} ${appointment.end_time}`).getTime();

                const hasOverlap = (
                    (appointmentStartTs === slotStartTs && appointmentEndTs === slotEndTs) ||
                    (appointmentStartTs >= slotStartTs && appointmentStartTs < slotEndTs) ||
                    (appointmentEndTs > slotStartTs && appointmentEndTs <= slotEndTs) ||
                    (appointmentStartTs <= slotStartTs && appointmentEndTs >= slotEndTs)
                );

                if (hasOverlap) {
                    availableCount -= appointment.appointments;
                }
            }
        }

        const isAvailable = availableCount > 0;

        if (isAvailable) {
            res.status(200).json({
                success: true,
                available: true,
                availableSlots: availableCount,
            });
            return;
        }

        // Slot not available - get alternative slots for this date
        const durationValue = duration || 60; // Default 60 minutes if not provided
        const alternativeSlots = getServiceSlots(dateDetails, durationValue, appointments);

        res.status(200).json({
            success: true,
            available: false,
            message: 'This slot is no longer available',
            alternativeSlots,
            date: dateStr,
        });
    } catch (error) {
        console.error('[checkSlotAvailability] Error:', error);
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

        // Build month/year conditions for next 3 months in a single query
        // Use first day of month to avoid date overflow (e.g., Jan 31 + 1 month = Mar 3, skipping Feb)
        const monthYearConditions = [];
        for (let i = 0; i < 3; i++) {
            const searchDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
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

        // Calculate end date for appointments query (3 months from start)
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 3);
        endDate.setHours(23, 59, 59, 999);

        // Fetch appointments for the entire date range
        const appointments = await getAppointmentsByDate(vendorServiceId, startDate, endDate);

        // Process dates and pick first 15 active days
        let activeDaysFound = 0;
        for (const dateDetails of allDates) {
            if (activeDaysFound >= activeDaysNeeded) break;

            const dateStr = moment(dateDetails.date).format().substring(0, 10);

            // Skip if already processed
            if (serviceSlotsByDate[dateStr]) continue;

            // Get slots for this date, checking against appointments
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