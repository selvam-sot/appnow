import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import Appointment from '../models/appointment.model';
import { AppError } from '../utils/appError.util';
import { asyncHandler } from '../utils/asyncHandler.util';
import { sendBookingConfirmationEmail } from '../services/email.service';
import { addEventToCalendar } from '../services/calendar.service';
import logger from '../config/logger';


export const createAppointment = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log("Appointment error:", req.body, errors)
        throw new AppError('Validation Error', 400);
    }

    const appointment = await Appointment.create(req.body);
    
    // Send confirmation email
    // await sendBookingConfirmationEmail(req.user!.email, {
    //     serviceId: appointment.vendorService.serviceId,
    //     serviceName: appointment.vendorService.serviceName,
    //     vendorId: appointment.vendorService.vendorId,
    //     vendorServiceName: appointment.vendorService.vendorServiceName,
    //     date: appointment.date.toDateString(),
    //     time: appointment.startTime
    // });

    // Add to Google Calendar
    // if (req.user!.googleAccessToken) {
    //     await addEventToCalendar(
    //         req.user!.googleAccessToken,
    //         `Appointment for ${appointment.vendorService.serviceName}`,
    //         `Appointment with ${appointment.vendorService.vendorServiceName}`,
    //         new Date(appointment.date + 'T' + appointment.startTime).toISOString(),
    //         new Date(appointment.date + 'T' + appointment.endTime).toISOString()
    //     );
    // }

    res.status(201).json(appointment);
});

// export const getAppointments = asyncHandler(async (req: Request, res: Response) => {
//     const appointments = await Appointment.find({ customer: req.user!._id })
//         .populate({
//         path: 'vendorService',
//         populate: { path: 'vendor service' }
//         });
//     res.json(appointments);
// });

export const getAppointments = asyncHandler(async (req: Request, res: Response) => {
    const appointments = await Appointment.find().populate('customerId').populate('vendorServiceId');
    res.json(appointments);
});

// export const getAppointmentById = asyncHandler(async (req: Request, res: Response) => {
//     const appointment = await Appointment.findById(req.params.id); //.populate('customerId').populate('vendorServiceId');
//     if (!appointment) {
//         throw new AppError('Appointment not found', 404);
//     }
//     if (appointment.customerId.toString() !== req.user!._id.toString()) {
//         throw new AppError('Not authorized to access this appointment', 403);
//     }
//     res.json(appointment);
// });

export const getAppointmentById = asyncHandler(async (req: Request, res: Response) => {
    const appointment = await Appointment.findById(req.params.id).populate('customerId').populate('vendorServiceId');
    if (!appointment) {
        throw new AppError('Appointment not found', 404);
    }
    res.json(appointment);
});

export const updateAppointment = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError('Validation Error', 400);
    }

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
        throw new AppError('Appointment not found', 404);
    }
    if (appointment.customerId.toString() !== req.user!._id.toString()) {
        throw new AppError('Not authorized to update this appointment', 403);
    }

    appointment.status = req.body.status || appointment.status;
    const updatedAppointment = await appointment.save();

    res.json(updatedAppointment);
});

export const deleteAppointment = asyncHandler(async (req: Request, res: Response) => {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
        throw new AppError('Appointment not found', 404);
    }
    if (appointment.customerId.toString() !== req.user!._id.toString()) {
        throw new AppError('Not authorized to delete this appointment', 403);
    }

    //await appointment.remove();
    res.json({ message: 'Appointment cancelled successfully' });
});

export const appointmentOperations = async (req: Request, res: Response) => {
    try {
        if (req.body.type == 'create-booking') {
            delete req.body.type;
            const appointment = await Appointment.create(req.body);
            res.status(201).json(appointment);
        } else if (req.body.type == 'update-booking') {
            // update booking
        } else {
            delete req.body.type;
            const appointments = await Appointment.find(req.body).populate('customerId').populate('vendorServiceId');
            res.json(appointments);
        }
    } catch (error: any) {
        logger.error(`Error in fetching categories: ${error.message}`);
        res.status(500).json({ message: 'Server error' });
    }
};