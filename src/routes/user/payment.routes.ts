import express from 'express';
import { body } from 'express-validator';
import {
    createPaymentIntent,
    confirmPayment,
    createStripeCustomer,
    handleWebhook,
    refundPayment
} from '../../controllers/payment.controller';

const router = express.Router();

// Create payment intent
router.post('/create-payment-intent', [
    body('amount').isNumeric().withMessage('Amount must be a number'),
    body('currency').optional().isString().withMessage('Currency must be a string'),
    body('customerId').optional().isString().withMessage('Customer ID must be a string'),
], createPaymentIntent);

// Confirm payment
router.post('/confirm-payment', [
    body('paymentIntentId').notEmpty().withMessage('Payment intent ID is required'),
], confirmPayment);

// Create Stripe customer
router.post('/create-customer', [
    body('email').isEmail().withMessage('Valid email is required'),
    body('name').notEmpty().withMessage('Name is required'),
    body('phone').optional().isMobilePhone('any').withMessage('Valid phone number required'),
], createStripeCustomer);

// Refund payment
router.post('/refund', [
    body('paymentIntentId').notEmpty().withMessage('Payment intent ID is required'),
    body('amount').optional().isNumeric().withMessage('Amount must be a number'),
], refundPayment);

// Webhook endpoint (no auth middleware)
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

export default router;