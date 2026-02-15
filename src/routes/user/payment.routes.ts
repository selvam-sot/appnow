import express from 'express';
import { body } from 'express-validator';
import {
    createPaymentIntent,
    confirmPayment,
    createStripeCustomer,
    handleWebhook,
    refundPayment,
    confirmWithMethod,
    confirmWithCard,
    createCheckoutSession,
    getPaymentHistory,
    getSavedPaymentMethods,
    deleteSavedPaymentMethod
} from '../../controllers/payment.controller';
import { paymentLimiter } from '../../middlewares/rateLimiter.middleware';

const router = express.Router();

// Apply payment rate limiter to all payment routes except webhook
router.use((req, res, next) => {
    // Skip rate limiting for webhook endpoint
    if (req.path === '/webhook') {
        return next();
    }
    return paymentLimiter(req, res, next);
});

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

router.post('/confirm-with-method', [
    body('paymentIntentId').notEmpty().withMessage('Payment intent ID is required'),
    body('paymentMethodId').notEmpty().withMessage('Payment method ID is required'),
], confirmWithMethod);

// Confirm payment with raw card details (Android fallback)
router.post('/confirm-with-card', [
    body('payment_intent_id').notEmpty().withMessage('Payment intent ID is required'),
    body('card_number').notEmpty().withMessage('Card number is required'),
    body('exp_month').notEmpty().withMessage('Expiry month is required'),
    body('exp_year').notEmpty().withMessage('Expiry year is required'),
    body('cvc').notEmpty().withMessage('CVC is required'),
], confirmWithCard);

// Webhook endpoint (no auth middleware)
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

router.post('/create-checkout-session', [
    body('amount').isNumeric().withMessage('Amount must be a number'),
    body('currency').optional().isString().withMessage('Currency must be a string'),
    body('successUrl').isURL().withMessage('Success URL must be valid'),
    body('cancelUrl').isURL().withMessage('Cancel URL must be valid'),
], createCheckoutSession);

// Get payment history
router.get('/history', getPaymentHistory);

// Saved payment methods
router.get('/saved-methods/:clerkId', paymentLimiter, getSavedPaymentMethods);
router.delete('/saved-methods/:paymentMethodId', paymentLimiter, deleteSavedPaymentMethod);

export default router;