import Stripe from 'stripe';
import logger from '../config/logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-06-20',
});

export interface PaymentIntentData {
    amount: number; // in cents
    currency: string;
    customerId?: string;
    metadata?: Record<string, string>;
}

export interface CustomerData {
    email: string;
    name: string;
    phone?: string;
}

export class StripeService {
    static async createPaymentIntent(data: PaymentIntentData): Promise<Stripe.PaymentIntent> {
        try {
            const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(data.amount * 100), // Convert to cents
                currency: data.currency || 'usd',
                customer: data.customerId,
                metadata: data.metadata || {},
                automatic_payment_methods: {
                    enabled: true,
                },
            });

            logger.info(`Payment intent created: ${paymentIntent.id}`);
            return paymentIntent;
        } catch (error: any) {
            logger.error(`Error creating payment intent: ${error.message}`);
            throw new Error(`Failed to create payment intent: ${error.message}`);
        }
    }

    static async createCustomer(data: CustomerData): Promise<Stripe.Customer> {
        try {
            const customer = await stripe.customers.create({
                email: data.email,
                name: data.name,
                phone: data.phone,
            });

            logger.info(`Stripe customer created: ${customer.id}`);
            return customer;
        } catch (error: any) {
            logger.error(`Error creating customer: ${error.message}`);
            throw new Error(`Failed to create customer: ${error.message}`);
        }
    }

    static async confirmPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
        try {
            const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
            logger.info(`Payment intent retrieved: ${paymentIntent.id}, status: ${paymentIntent.status}`);
            return paymentIntent;
        } catch (error: any) {
            logger.error(`Error confirming payment intent: ${error.message}`);
            throw new Error(`Failed to confirm payment intent: ${error.message}`);
        }
    }

    static async refundPayment(paymentIntentId: string, amount?: number): Promise<Stripe.Refund> {
        try {
            const refund = await stripe.refunds.create({
                payment_intent: paymentIntentId,
                amount: amount ? Math.round(amount * 100) : undefined,
            });

            logger.info(`Refund created: ${refund.id}`);
            return refund;
        } catch (error: any) {
            logger.error(`Error creating refund: ${error.message}`);
            throw new Error(`Failed to create refund: ${error.message}`);
        }
    }

    static async constructWebhookEvent(payload: string | Buffer, signature: string): Promise<Stripe.Event> {
        try {
            const event = stripe.webhooks.constructEvent(
                payload,
                signature,
                process.env.STRIPE_WEBHOOK_SECRET!
            );
            return event;
        } catch (error: any) {
            logger.error(`Webhook signature verification failed: ${error.message}`);
            throw new Error(`Webhook signature verification failed: ${error.message}`);
        }
    }
}

export default StripeService;