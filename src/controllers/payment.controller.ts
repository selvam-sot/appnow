import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { AppError } from '../utils/appError.util';
import { asyncHandler } from '../utils/asyncHandler.util';
import StripeService from '../services/stripe.service';
import logger from '../config/logger';
import Stripe from 'stripe';

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
                userId: 'anonymous', // Temporarily hardcoded instead of req.user
            }
        });

        res.status(200).json({
            success: true,
            data: {
                client_secret: paymentIntent.client_secret,
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
                amount: paymentIntent.amount / 100,
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

// export const handleWebhook = asyncHandler(async (req: Request, res: Response) => {
//     const payload = req.body;
//     const signature = req.headers['stripe-signature'] as string;

//     try {
//         const event = await StripeService.constructWebhookEvent(payload, signature);

//         switch (event.type) {
//             case 'payment_intent.succeeded':
//                 const paymentIntent = event.data.object;
//                 logger.info(`Payment for ${paymentIntent.amount} succeeded!`);
//                 break;
//             case 'payment_intent.payment_failed':
//                 const failedPayment = event.data.object;
//                 logger.error(`Payment for ${failedPayment.amount} failed!`);
//                 break;
//             default:
//                 logger.info(`Unhandled event type ${event.type}`);
//         }

//         res.status(200).json({ received: true });
//     } catch (error: any) {
//         logger.error(`Webhook error: ${error.message}`);
//         res.status(400).json({
//             success: false,
//             message: 'Webhook signature verification failed',
//             error: error.message
//         });
//     }
// });

export const handleWebhook = asyncHandler(async (req: Request, res: Response) => {
    const payload = req.body;
    const signature = req.headers['stripe-signature'] as string;

    try {
        const event = await StripeService.constructWebhookEvent(payload, signature);

        switch (event.type) {
            case 'checkout.session.completed':
                const session = event.data.object as Stripe.Checkout.Session;
                logger.info(`Payment successful for session: ${session.id}`);
                // Handle successful payment here - create booking, etc.
                break;
            case 'payment_intent.succeeded':
                const paymentIntent = event.data.object;
                logger.info(`Payment for ${paymentIntent.amount} succeeded!`);
                break;
            case 'payment_intent.payment_failed':
                const failedPayment = event.data.object;
                logger.error(`Payment for ${failedPayment.amount} failed!`);
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

export const confirmWithMethod = asyncHandler(async (req: Request, res: Response) => {
    try {
        const { paymentIntentId, paymentMethodId, returnUrl } = req.body;

        const paymentIntent = await StripeService.confirmPaymentWithPaymentMethod(
            paymentIntentId,
            paymentMethodId,
            returnUrl
        );

        res.status(200).json({
            success: true,
            data: {
                id: paymentIntent.id,
                status: paymentIntent.status,
                amount: paymentIntent.amount / 100,
                currency: paymentIntent.currency,
            }
        });
    } catch (error: any) {
        console.error(`Error confirming payment with method: ${error.message}`);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
})

export const createCheckoutSession = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError('Validation Error', 400);
    }

    const { amount, currency = 'usd', metadata, successUrl, cancelUrl } = req.body;

    try {
        const session = await StripeService.createCheckoutSession({
            amount,
            currency,
            metadata: {
                ...metadata,
                userId: 'anonymous',
            },
            successUrl,
            cancelUrl,
        });

        res.status(200).json({
            success: true,
            data: {
                sessionId: session.id,
                checkoutUrl: session.url,
            }
        });
    } catch (error: any) {
        logger.error(`Error creating checkout session: ${error.message}`);
        res.status(500).json({
            success: false,
            message: 'Failed to create checkout session',
            error: error.message
        });
    }
});