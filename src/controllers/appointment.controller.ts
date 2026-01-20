import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import Appointment from '../models/appointment.model';
import VendorService from '../models/vendor-service.model';
import { AppError } from '../utils/appError.util';
import { asyncHandler } from '../utils/asyncHandler.util';
import { sendBookingConfirmationEmail } from '../services/email.service';
import { addEventToCalendar } from '../services/calendar.service';
import StripeService from '../services/stripe.service';
import { sendBookingConfirmationNotification } from '../services/pushNotification.service';
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

export const getAppointments = asyncHandler(async (req: Request, res: Response) => {
    const appointments = await Appointment.find().populate('customerId').populate('vendorServiceId');
    res.json(appointments);
});

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

// Fixed the type annotation to properly handle async function
export const appointmentOperations = asyncHandler(async (req: Request, res: Response) => {
    if (req.body.type == 'create-booking') {
        delete req.body.type;
        
        // Create Stripe payment intent if payment mode is credit-card
        let paymentIntentId = null;
        let clientSecret = null;
        
        if (req.body.paymentMode === 'credit-card') {
            try {
                const paymentIntent = await StripeService.createPaymentIntent({
                    amount: req.body.total,
                    currency: 'usd',
                    metadata: {
                        appointmentType: 'booking',
                        customerId: req.body.customerId,
                        vendorServiceId: req.body.vendorServiceId,
                    }
                });
                
                paymentIntentId = paymentIntent.id;
                clientSecret = paymentIntent.client_secret;
                
                // Add payment intent ID to appointment data
                req.body.paymentIntentId = paymentIntentId;
                req.body.paymentStatus = 'pending';
                
            } catch (stripeError: any) {
                logger.error(`Stripe payment intent creation failed: ${stripeError.message}`);
                return res.status(400).json({
                    success: false,
                    message: 'Payment processing failed',
                    error: stripeError.message
                });
            }
        } else {
            // For other payment methods, mark as completed
            req.body.paymentStatus = 'completed';
        }
        
        const appointment = await Appointment.create(req.body);

        // Send booking confirmation push notification
        try {
            // Get vendor service details for the notification
            const vendorService = await VendorService.findById(req.body.vendorServiceId)
                .populate('vendorId', 'name')
                .populate('serviceId', 'name')
                .lean();

            if (vendorService) {
                const appointmentDate = new Date(req.body.appointmentDate);
                const formattedDate = appointmentDate.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                });

                await sendBookingConfirmationNotification(
                    req.body.customerId,
                    {
                        serviceName: (vendorService.serviceId as any)?.name || 'Service',
                        vendorName: (vendorService.vendorId as any)?.name,
                        date: formattedDate,
                        time: req.body.startTime,
                        appointmentId: appointment._id.toString(),
                    }
                );
                logger.info(`Booking confirmation notification sent for appointment ${appointment._id}`);
            }
        } catch (notificationError: any) {
            // Don't fail the booking if notification fails
            logger.error(`Failed to send booking confirmation notification: ${notificationError.message}`);
        }

        res.status(201).json({
            success: true,
            data: appointment,
            payment: {
                paymentIntentId,
                clientSecret,
                requiresPaymentMethod: req.body.paymentMode === 'credit-card'
            }
        });
        
    } else if (req.body.type == 'update-booking') {
        delete req.body.type;
        const { appointmentId, ...updateData } = req.body;
        
        const appointment = await Appointment.findByIdAndUpdate(
            appointmentId, 
            updateData, 
            { new: true }
        ).populate('customerId').populate('vendorServiceId');
        
        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }
        
        res.status(200).json({
            success: true,
            data: appointment,
        });
        
    } else if (req.body.type == 'confirm-payment') {
        delete req.body.type;
        const { paymentIntentId, appointmentId } = req.body;
        
        try {
            // Verify payment with Stripe
            const paymentIntent = await StripeService.confirmPaymentIntent(paymentIntentId);
            
            if (paymentIntent.status === 'succeeded') {
                // Update appointment payment status
                const appointment = await Appointment.findByIdAndUpdate(
                    appointmentId,
                    { 
                        paymentStatus: 'completed',
                        status: 'confirmed' 
                    },
                    { new: true }
                );
                
                res.status(200).json({
                    success: true,
                    message: 'Payment confirmed and appointment booked successfully',
                    data: appointment
                });
            } else {
                res.status(400).json({
                    success: false,
                    message: 'Payment not successful',
                    paymentStatus: paymentIntent.status
                });
            }
            
        } catch (stripeError: any) {
            logger.error(`Payment confirmation failed: ${stripeError.message}`);
            res.status(400).json({
                success: false,
                message: 'Payment confirmation failed',
                error: stripeError.message
            });
        }
        
    } else {
        // Get appointments
        delete req.body.type;
        const appointments = await Appointment.find(req.body).populate('customerId').populate('vendorServiceId');
        res.status(200).json({
            success: true,
            count: appointments.length,
            data: appointments,
        });
    }
});