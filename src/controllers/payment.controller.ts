import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { AppError } from '../utils/appError.util';
import { asyncHandler } from '../utils/asyncHandler.util';
import StripeService from '../services/stripe.service';
import logger from '../config/logger';

export const createPaymentIntent = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError('Validation Error', 400);
    }

    const { amount, currency = 'usd', customerId, metadata } = req.body;

    try {
        const paymentIntent = await StripeService.createPaymentIntent({
            amount,
            currency,
            customerId,
            metadata: {
                ...metadata,
                userId: req.user?._id?.toString() || 'unknown',
            }
        });

        res.status(200).json({
            success: true,
            data: {
                clientSecret: paymentIntent.client_secret,
                paymentIntentId: paymentIntent.id,
            }
        });
    } catch (error: any) {
        logger.error(`Error creating payment intent: ${error.message}`);
        res.status(500).json({
            success: false,
            message: 'Failed to create payment intent',
            error: error.message
        });
    }
});

export const confirmPayment = asyncHandler(async (req: Request, res: Response) => {
    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
        throw new AppError('Payment intent ID is required', 400);
    }

    try {
        const paymentIntent = await StripeService.confirmPaymentIntent(paymentIntentId);

        res.status(200).json({
            success: true,
            data: {
                id: paymentIntent.id,
                status: paymentIntent.status,
                amount: paymentIntent.amount / 100, // Convert back to dollars
                currency: paymentIntent.currency,
            }
        });
    } catch (error: any) {
        logger.error(`Error confirming payment: ${error.message}`);
        res.status(500).json({
            success: false,
            message: 'Failed to confirm payment',
            error: error.message
        });
    }
});

export const createStripeCustomer = asyncHandler(async (req: Request, res: Response) => {
    const { email, name, phone } = req.body;

    if (!email || !name) {
        throw new AppError('Email and name are required', 400);
    }

    try {
        const customer = await StripeService.createCustomer({
            email,
            name,
            phone
        });

        res.status(200).json({
            success: true,
            data: {
                customerId: customer.id,
                email: customer.email,
                name: customer.name,
            }
        });
    } catch (error: any) {
        logger.error(`Error creating Stripe customer: ${error.message}`);
        res.status(500).json({
            success: false,
            message: 'Failed to create customer',
            error: error.message
        });
    }
});

export const handleWebhook = asyncHandler(async (req: Request, res: Response) => {
    const payload = req.body;
    const signature = req.headers['stripe-signature'] as string;

    try {
        const event = await StripeService.constructWebhookEvent(payload, signature);

        // Handle the event
        switch (event.type) {
            case 'payment_intent.succeeded':
                const paymentIntent = event.data.object;
                logger.info(`Payment for ${paymentIntent.amount} succeeded!`);
                // Update your database here
                break;
            case 'payment_intent.payment_failed':
                const failedPayment = event.data.object;
                logger.error(`Payment for ${failedPayment.amount} failed!`);
                // Handle failed payment
                break;
            default:
                logger.info(`Unhandled event type ${event.type}`);
        }

        res.status(200).json({ received: true });
    } catch (error: any) {
        logger.error(`Webhook error: ${error.message}`);
        res.status(400).json({
            success: false,
            message: 'Webhook signature verification failed',
            error: error.message
        });
    }
});

export const refundPayment = asyncHandler(async (req: Request, res: Response) => {
    const { paymentIntentId, amount } = req.body;

    if (!paymentIntentId) {
        throw new AppError('Payment intent ID is required', 400);
    }

    try {
        const refund = await StripeService.refundPayment(paymentIntentId, amount);

        res.status(200).json({
            success: true,
            data: {
                refundId: refund.id,
                amount: refund.amount ? refund.amount / 100 : 0,
                status: refund.status,
            }
        });
    } catch (error: any) {
        logger.error(`Error processing refund: ${error.message}`);
        res.status(500).json({
            success: false,
            message: 'Failed to process refund',
            error: error.message
        });
    }
});