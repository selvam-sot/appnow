import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import Appointment from '../models/appointment.model';
import VendorService from '../models/vendor-service.model';
import Vendor from '../models/vendor.model';
import SlotLock from '../models/slot-lock.model';
import User from '../models/user.model';
import { AppError } from '../utils/appError.util';
import { asyncHandler } from '../utils/asyncHandler.util';
import { sendBookingConfirmationEmail } from '../services/email.service';
import { addEventToCalendar } from '../services/calendar.service';
import StripeService from '../services/stripe.service';
import { sendBookingConfirmationNotification } from '../services/push-notification.service';
import {
    scheduleAppointmentReminders,
    cancelAppointmentReminders,
    rescheduleAppointmentReminders,
    syncTodaySchedule
} from '../services/notification-scheduler.service';
import { notifyWaitlistedUsers } from './waitlist.controller';
import logger from '../config/logger';
import mongoose from 'mongoose';

export const createAppointment = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
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
    // Build filter - for vendor users, only show their appointments
    const filter: Record<string, any> = {};

    if (req.user && req.user.role === 'vendor') {
        // Find the vendor associated with this user
        const vendor = await Vendor.findOne({ userId: req.user._id });
        if (vendor) {
            // Get all vendor services for this vendor
            const vendorServices = await VendorService.find({ vendorId: vendor._id }).select('_id');
            const serviceIds = vendorServices.map(vs => vs._id);
            filter.vendorServiceId = { $in: serviceIds };
        }
    }

    const appointments = await Appointment.find(filter).populate('customerId').populate('vendorServiceId');
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

        // Schedule reminder notifications for this appointment
        try {
            const populatedAppointment = await Appointment.findById(appointment._id)
                .populate('customerId', '_id')
                .populate({
                    path: 'vendorServiceId',
                    populate: [
                        { path: 'vendorId', select: 'vendorName' },
                        { path: 'serviceId', select: 'name' }
                    ]
                })
                .lean();

            if (populatedAppointment) {
                await scheduleAppointmentReminders(populatedAppointment as any);
                logger.info(`Scheduled reminders for appointment ${appointment._id}`);
            }

            // Sync today's schedule to process any due notifications immediately
            syncTodaySchedule().catch(err => {
                logger.error(`Failed to sync today's schedule: ${err.message}`);
            });
        } catch (schedulerError: any) {
            // Don't fail the booking if scheduler fails
            logger.error(`Failed to schedule reminders: ${schedulerError.message}`);
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

        // Reschedule reminder notifications
        try {
            await rescheduleAppointmentReminders(appointmentId);
            logger.info(`Appointment ${appointmentId} rescheduled from ${oldDate} ${oldTime} to ${appointmentDate} ${startTime}`);
        } catch (schedulerError: any) {
            logger.error(`Failed to reschedule reminders: ${schedulerError.message}`);
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

    } else if (req.body.type == 'get-cancellation-policy') {
        // Get cancellation policy preview (refund amount before confirming)
        delete req.body.type;
        const { appointmentId } = req.body;

        const appointment = await Appointment.findById(appointmentId);

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }

        // Calculate hours until appointment
        const appointmentDateTime = new Date(appointment.appointmentDate);
        if (appointment.startTime) {
            const [hours, minutes] = appointment.startTime.split(':').map(Number);
            appointmentDateTime.setHours(hours, minutes, 0, 0);
        }
        const hoursUntilAppointment = (appointmentDateTime.getTime() - Date.now()) / (1000 * 60 * 60);

        // Refund policy thresholds
        let refundPercentage = 0;
        let policyMessage = '';
        let policyTier = '';

        if (hoursUntilAppointment >= 24) {
            refundPercentage = 100;
            policyMessage = 'Full refund - You are cancelling more than 24 hours before the appointment.';
            policyTier = 'full';
        } else if (hoursUntilAppointment >= 12) {
            refundPercentage = 75;
            policyMessage = '75% refund - You are cancelling 12-24 hours before the appointment.';
            policyTier = 'partial_75';
        } else if (hoursUntilAppointment >= 2) {
            refundPercentage = 50;
            policyMessage = '50% refund - You are cancelling 2-12 hours before the appointment.';
            policyTier = 'partial_50';
        } else {
            refundPercentage = 0;
            policyMessage = 'No refund - Cancellations less than 2 hours before the appointment are not eligible for refund.';
            policyTier = 'no_refund';
        }

        const originalAmount = appointment.total || 0;
        const refundAmount = (originalAmount * refundPercentage) / 100;
        const nonRefundableAmount = originalAmount - refundAmount;

        res.status(200).json({
            success: true,
            cancellationPolicy: {
                hoursUntilAppointment: Math.max(0, hoursUntilAppointment).toFixed(1),
                refundPercentage,
                policyTier,
                policyMessage,
                originalAmount,
                refundAmount,
                nonRefundableAmount,
                paymentMethod: appointment.paymentMode,
                isEligibleForRefund: refundPercentage > 0 && appointment.paymentIntentId && appointment.paymentStatus === 'completed'
            },
            policyDetails: [
                { threshold: '24+ hours', refund: '100%', description: 'Full refund' },
                { threshold: '12-24 hours', refund: '75%', description: 'Partial refund' },
                { threshold: '2-12 hours', refund: '50%', description: 'Partial refund' },
                { threshold: 'Less than 2 hours', refund: '0%', description: 'No refund' }
            ]
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

        // Calculate hours until appointment for refund policy
        const appointmentDateTime = new Date(appointment.appointmentDate);
        if (appointment.startTime) {
            const [hours, minutes] = appointment.startTime.split(':').map(Number);
            appointmentDateTime.setHours(hours, minutes, 0, 0);
        }
        const hoursUntilAppointment = (appointmentDateTime.getTime() - Date.now()) / (1000 * 60 * 60);

        // Refund policy thresholds (industry standard)
        // 24+ hours: 100% refund
        // 12-24 hours: 75% refund
        // 2-12 hours: 50% refund
        // Less than 2 hours: No refund (0%)
        let refundPercentage = 0;
        let refundPolicyMessage = '';

        if (hoursUntilAppointment >= 24) {
            refundPercentage = 100;
            refundPolicyMessage = 'Full refund (cancelled 24+ hours before appointment)';
        } else if (hoursUntilAppointment >= 12) {
            refundPercentage = 75;
            refundPolicyMessage = '75% refund (cancelled 12-24 hours before appointment)';
        } else if (hoursUntilAppointment >= 2) {
            refundPercentage = 50;
            refundPolicyMessage = '50% refund (cancelled 2-12 hours before appointment)';
        } else {
            refundPercentage = 0;
            refundPolicyMessage = 'No refund (cancelled less than 2 hours before appointment)';
        }

        let refundResult = null;

        // Process refund if payment was made via credit card and refund percentage > 0
        if (appointment.paymentIntentId && appointment.paymentStatus === 'completed' && refundPercentage > 0) {
            try {
                const refundAmount = (appointment.total * refundPercentage) / 100;

                // Pass amount for partial refund, undefined for full refund
                const refund = await StripeService.refundPayment(
                    appointment.paymentIntentId,
                    refundPercentage < 100 ? refundAmount : undefined
                );

                refundResult = {
                    refundId: refund.id,
                    refundStatus: refund.status,
                    refundAmount: refund.amount ? refund.amount / 100 : refundAmount,
                    refundPercentage,
                    originalAmount: appointment.total,
                    policyMessage: refundPolicyMessage
                };

                // Update appointment with refund info
                appointment.refundId = refund.id;
                appointment.refundStatus = (refund.status as 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled') || 'pending';
                appointment.refundAmount = refund.amount ? refund.amount / 100 : refundAmount;
                appointment.paymentStatus = refundPercentage === 100 ? 'refunded' : 'partially_refunded';

                logger.info(`Refund processed for appointment ${appointmentId}: ${refund.id} (${refundPercentage}% = $${refundAmount.toFixed(2)})`);
            } catch (refundError: any) {
                logger.error(`Refund failed for appointment ${appointmentId}: ${refundError.message}`);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to process refund',
                    error: refundError.message
                });
            }
        } else if (appointment.paymentIntentId && appointment.paymentStatus === 'completed' && refundPercentage === 0) {
            // No refund due to late cancellation
            refundResult = {
                refundId: null,
                refundStatus: 'not_eligible',
                refundAmount: 0,
                refundPercentage: 0,
                originalAmount: appointment.total,
                policyMessage: refundPolicyMessage
            };
            logger.info(`No refund for appointment ${appointmentId} - cancelled less than 2 hours before`);
        }

        // Update appointment status
        appointment.status = 'cancelled';
        appointment.cancelledAt = new Date();
        appointment.cancellationReason = cancellationReason || 'Cancelled by customer';

        const updatedAppointment = await appointment.save();

        // Cancel scheduled reminder notifications
        try {
            const cancelledCount = await cancelAppointmentReminders(appointmentId);
            logger.info(`Appointment ${appointmentId} cancelled successfully. ${cancelledCount} reminders cancelled.`);
        } catch (schedulerError: any) {
            logger.error(`Failed to cancel reminders: ${schedulerError.message}`);
        }

        // Notify waitlisted users about the newly available slot
        notifyWaitlistedUsers(
            appointment.vendorServiceId.toString(),
            appointment.appointmentDate
        ).catch(() => {}); // Fire and forget

        res.status(200).json({
            success: true,
            message: refundResult ? `Appointment cancelled. ${refundResult.policyMessage}` : 'Appointment cancelled successfully',
            data: updatedAppointment,
            refund: refundResult,
            cancellationPolicy: {
                hoursUntilAppointment: Math.max(0, hoursUntilAppointment).toFixed(1),
                refundPercentage,
                policyMessage: refundPolicyMessage
            }
        });

    } else if (req.body.type == 'mark-missed') {
        delete req.body.type;
        const { appointmentId, reason } = req.body;

        if (!reason || reason.trim().length < 5) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a reason (at least 5 characters)'
            });
        }

        const appointment = await Appointment.findById(appointmentId);

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }

        // Check if customer owns this appointment
        if (appointment.customerId.toString() !== req.body.customerId) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this appointment'
            });
        }

        if (!['confirmed', 'completed'].includes(appointment.status)) {
            return res.status(400).json({
                success: false,
                message: 'Only confirmed or completed appointments can be marked as missed'
            });
        }

        appointment.status = 'missed';
        (appointment as any).statusChangedBy = 'customer';
        (appointment as any).statusReason = reason.trim();
        await appointment.save();

        res.status(200).json({
            success: true,
            message: 'Appointment marked as missed',
            data: appointment
        });

    } else if (req.body.type == 'mark-failed') {
        delete req.body.type;
        const { appointmentId, reason } = req.body;

        if (!reason || reason.trim().length < 5) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a reason (at least 5 characters)'
            });
        }

        const appointment = await Appointment.findById(appointmentId);

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }

        // Check if customer owns this appointment
        if (appointment.customerId.toString() !== req.body.customerId) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this appointment'
            });
        }

        if (!['confirmed', 'completed'].includes(appointment.status)) {
            return res.status(400).json({
                success: false,
                message: 'Only confirmed or completed appointments can be marked as failed'
            });
        }

        appointment.status = 'failed';
        (appointment as any).statusChangedBy = 'customer';
        (appointment as any).statusReason = reason.trim();
        await appointment.save();

        res.status(200).json({
            success: true,
            message: 'Appointment marked as failed',
            data: appointment
        });

    } else {
        // Get appointments (list operation)
        delete req.body.type;

        // Extract sort parameter, default to descending by appointmentDate (latest first)
        const sort = req.body.sort || { appointmentDate: -1 };
        delete req.body.sort;

        // Whitelist allowed query fields to prevent NoSQL injection
        const allowedFields = ['customerId', 'vendorServiceId', 'status', 'appointmentDate', 'startTime', 'endTime'];
        const filter: Record<string, any> = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                filter[field] = req.body[field];
            }
        }

        const appointments = await Appointment.find(filter)
            .populate('customerId')
            .populate({
                path: 'vendorServiceId',
                populate: {
                    path: 'vendorId',
                    select: 'vendorName name phone email address'
                }
            })
            .sort(sort);

        res.status(200).json({
            success: true,
            count: appointments.length,
            data: appointments,
        });
    }
});