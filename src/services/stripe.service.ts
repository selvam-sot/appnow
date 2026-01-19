import Stripe from 'stripe';
import logger from '../config/logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

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
            console.log("Key:", process.env.STRIPE_SECRET_KEY!)
            const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(data.amount), // Convert to cents
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

    // static async confirmPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    //     try {
    //         const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    //         logger.info(`Payment intent retrieved: ${paymentIntent.id}, status: ${paymentIntent.status}`);
    //         return paymentIntent;
    //     } catch (error: any) {
    //         logger.error(`Error confirming payment intent: ${error.message}`);
    //         throw new Error(`Failed to confirm payment intent: ${error.message}`);
    //     }
    // }

    static async confirmPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
        console.log("confirmPayment2")
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        console.log("confirmPayment3")
        return paymentIntent;
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

    static async confirmPaymentWithPaymentMethod(
        paymentIntentId: string,
        paymentMethodId: string,
        returnUrl?: string
    ): Promise<Stripe.PaymentIntent> {
        try {
            const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
                payment_method: paymentMethodId,
                return_url: returnUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/return`
            });

            logger.info(`Payment intent confirmed: ${paymentIntent.id}, status: ${paymentIntent.status}`);
            return paymentIntent;
        } catch (error: any) {
            logger.error(`Error confirming payment intent: ${error.message}`);
            throw new Error(`Failed to confirm payment intent: ${error.message}`);
        }
    }

    // Create a payment method from raw card details and confirm payment
    // This is used for Android fallback flow where native SDK is not available
    static async confirmPaymentWithCard(
        paymentIntentId: string,
        cardDetails: {
            number: string;
            exp_month: number;
            exp_year: number;
            cvc: string;
        }
    ): Promise<Stripe.PaymentIntent> {
        try {
            // First, create a payment method from the card details
            const paymentMethod = await stripe.paymentMethods.create({
                type: 'card',
                card: {
                    number: cardDetails.number.replace(/\s/g, ''), // Remove spaces
                    exp_month: cardDetails.exp_month,
                    exp_year: cardDetails.exp_year,
                    cvc: cardDetails.cvc,
                },
            });

            logger.info(`Payment method created: ${paymentMethod.id}`);

            // Then confirm the payment intent with the payment method
            const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
                payment_method: paymentMethod.id,
            });

            logger.info(`Payment intent confirmed: ${paymentIntent.id}, status: ${paymentIntent.status}`);
            return paymentIntent;
        } catch (error: any) {
            logger.error(`Error confirming payment with card: ${error.message}`);
            throw new Error(`Failed to confirm payment: ${error.message}`);
        }
    }

    static async createCheckoutSession(data: {
        amount: number;
        currency: string;
        metadata?: Record<string, string>;
        successUrl: string;
        cancelUrl: string;
    }): Promise<Stripe.Checkout.Session> {
        try {
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [
                    {
                        price_data: {
                            currency: data.currency,
                            product_data: {
                                name: 'Appointment Service',
                                description: 'Professional service appointment booking',
                            },
                            unit_amount: data.amount, // Already in cents from frontend
                        },
                        quantity: 1,
                    },
                ],
                mode: 'payment',
                success_url: data.successUrl,
                cancel_url: data.cancelUrl,
                metadata: data.metadata || {},
            });

            logger.info(`Checkout session created: ${session.id}`);
            return session;
        } catch (error: any) {
            logger.error(`Error creating checkout session: ${error.message}`);
            throw new Error(`Failed to create checkout session: ${error.message}`);
        }
    }
}

export default StripeService;