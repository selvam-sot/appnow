import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import Appointment from '../models/appointment.model';
import VendorService from '../models/vendor-service.model';
import SlotLock from '../models/slot-lock.model';
import User from '../models/user.model';
import { AppError } from '../utils/appError.util';
import { asyncHandler } from '../utils/asyncHandler.util';
import { sendBookingConfirmationEmail } from '../services/email.service';
import { addEventToCalendar } from '../services/calendar.service';
import StripeService from '../services/stripe.service';
import { sendBookingConfirmationNotification } from '../services/pushNotification.service';
import logger from '../config/logger';
import mongoose from 'mongoose';

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

        // Check if slot is locked by another user
        if (req.body.vendorServiceId && req.body.appointmentDate && req.body.startTime && req.body.endTime) {
            const existingLock = await SlotLock.findOne({
                vendorServiceId: new mongoose.Types.ObjectId(req.body.vendorServiceId),
                date: new Date(req.body.appointmentDate),
                fromTime: req.body.startTime,
                toTime: req.body.endTime
            });

            if (existingLock) {
                const customerId = req.body.customerId;
                const isOwnLock = customerId && existingLock.lockedBy.toString() === customerId;

                if (!isOwnLock) {
                    return res.status(409).json({
                        success: false,
                        message: 'This slot is temporarily locked by another user. Please try again shortly or select a different time.',
                        lockedUntil: existingLock.expiresAt
                    });
                }
            }
        }

        // Check if slot is already booked
        if (req.body.vendorServiceId && req.body.appointmentDate && req.body.startTime && req.body.endTime) {
            const existingAppointment = await Appointment.findOne({
                vendorServiceId: new mongoose.Types.ObjectId(req.body.vendorServiceId),
                appointmentDate: new Date(req.body.appointmentDate),
                startTime: req.body.startTime,
                endTime: req.body.endTime,
                status: { $nin: ['cancelled', 'rejected'] }
            });

            if (existingAppointment) {
                return res.status(409).json({
                    success: false,
                    message: 'This slot is already booked. Please select a different time.'
                });
            }
        }

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

        // Release the slot lock after successful appointment creation
        try {
            if (req.body.vendorServiceId && req.body.appointmentDate && req.body.startTime && req.body.endTime) {
                await SlotLock.deleteOne({
                    vendorServiceId: new mongoose.Types.ObjectId(req.body.vendorServiceId),
                    date: new Date(req.body.appointmentDate),
                    fromTime: req.body.startTime,
                    toTime: req.body.endTime
                });
                logger.info(`Slot lock released after booking for appointment ${appointment._id}`);
            }
        } catch (lockError: any) {
            // Don't fail the booking if lock release fails (TTL will clean it up)
            logger.error(`Failed to release slot lock: ${lockError.message}`);
        }

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
                ).populate('customerId').populate('vendorServiceId');

                // Send booking confirmation email
                if (appointment) {
                    try {
                        const customer = await User.findById(appointment.customerId);
                        const vendorService = await VendorService.findById(appointment.vendorServiceId)
                            .populate('vendorId', 'vendorName')
                            .populate('serviceId', 'name');

                        if (customer?.email && vendorService) {
                            const appointmentDate = new Date(appointment.appointmentDate);
                            const formattedDate = appointmentDate.toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                            });

                            await sendBookingConfirmationEmail(customer.email, {
                                serviceName: (vendorService.serviceId as any)?.name || 'Service',
                                vendorServiceName: (vendorService.vendorId as any)?.vendorName || 'Provider',
                                date: formattedDate,
                                time: appointment.startTime,
                            });
                            logger.info(`Booking confirmation email sent to ${customer.email} for appointment ${appointmentId}`);
                        }
                    } catch (emailError: any) {
                        // Don't fail the payment confirmation if email fails
                        logger.error(`Failed to send booking confirmation email: ${emailError.message}`);
                    }
                }

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
        
    } else if (req.body.type == 'reschedule-appointment') {
        delete req.body.type;
        const { appointmentId, appointmentDate, startTime, endTime } = req.body;

        // Find the appointment
        const appointment = await Appointment.findById(appointmentId);

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }

        // Check if appointment can be rescheduled
        if (appointment.status === 'cancelled') {
            return res.status(400).json({
                success: false,
                message: 'Cannot reschedule a cancelled appointment'
            });
        }

        if (appointment.status === 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Cannot reschedule a completed appointment'
            });
        }

        // Store old date/time for notification
        const oldDate = appointment.appointmentDate;
        const oldTime = appointment.startTime;

        // Update appointment with new date/time
        appointment.appointmentDate = new Date(appointmentDate);
        appointment.startTime = startTime;
        appointment.endTime = endTime;

        const updatedAppointment = await appointment.save();

        // Send reschedule notification
        try {
            const vendorService = await VendorService.findById(appointment.vendorServiceId)
                .populate('vendorId', 'name')
                .populate('serviceId', 'name')
                .lean();

            if (vendorService) {
                // TODO: Send reschedule push notification
                logger.info(`Appointment ${appointmentId} rescheduled from ${oldDate} ${oldTime} to ${appointmentDate} ${startTime}`);
            }
        } catch (notificationError: any) {
            logger.error(`Failed to send reschedule notification: ${notificationError.message}`);
        }

        res.status(200).json({
            success: true,
            message: 'Appointment rescheduled successfully',
            data: updatedAppointment,
            previousSchedule: {
                date: oldDate,
                time: oldTime
            }
        });

    } else if (req.body.type == 'cancel-appointment') {
        delete req.body.type;
        const { appointmentId, cancellationReason } = req.body;

        // Find the appointment
        const appointment = await Appointment.findById(appointmentId);

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }

        // Check if appointment can be cancelled
        if (appointment.status === 'cancelled') {
            return res.status(400).json({
                success: false,
                message: 'Appointment is already cancelled'
            });
        }

        if (appointment.status === 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Cannot cancel a completed appointment'
            });
        }

        let refundResult = null;

        // Process refund if payment was made via credit card
        if (appointment.paymentIntentId && appointment.paymentStatus === 'completed') {
            try {
                // Full refund
                const refund = await StripeService.refundPayment(appointment.paymentIntentId);

                refundResult = {
                    refundId: refund.id,
                    refundStatus: refund.status,
                    refundAmount: refund.amount ? refund.amount / 100 : appointment.total
                };

                // Update appointment with refund info
                appointment.refundId = refund.id;
                appointment.refundStatus = refund.status;
                appointment.refundAmount = refund.amount ? refund.amount / 100 : appointment.total;
                appointment.paymentStatus = 'refunded';

                logger.info(`Refund processed for appointment ${appointmentId}: ${refund.id}`);
            } catch (refundError: any) {
                logger.error(`Refund failed for appointment ${appointmentId}: ${refundError.message}`);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to process refund',
                    error: refundError.message
                });
            }
        }

        // Update appointment status
        appointment.status = 'cancelled';
        appointment.cancelledAt = new Date();
        appointment.cancellationReason = cancellationReason || 'Cancelled by customer';

        const updatedAppointment = await appointment.save();

        // Send cancellation notification
        try {
            const vendorService = await VendorService.findById(appointment.vendorServiceId)
                .populate('vendorId', 'name')
                .populate('serviceId', 'name')
                .lean();

            if (vendorService) {
                // TODO: Send cancellation push notification
                logger.info(`Appointment ${appointmentId} cancelled successfully`);
            }
        } catch (notificationError: any) {
            logger.error(`Failed to send cancellation notification: ${notificationError.message}`);
        }

        res.status(200).json({
            success: true,
            message: refundResult ? 'Appointment cancelled and refund initiated' : 'Appointment cancelled successfully',
            data: updatedAppointment,
            refund: refundResult
        });

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