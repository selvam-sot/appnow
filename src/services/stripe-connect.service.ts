import Stripe from 'stripe';
import logger from '../config/logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export interface CreateConnectAccountInput {
  vendorId: string;
  email: string;
  businessName?: string;
  country?: string; // ISO2, default 'US'
}

export interface OnboardingLinkInput {
  stripeConnectAccountId: string;
  refreshUrl: string;
  returnUrl: string;
}

/**
 * Stripe Connect service — handles vendor onboarding for marketplace payouts.
 *
 * Flow:
 *   1. Vendor signs up → we call createConnectAccount() to issue an acct_xxx
 *   2. Vendor is redirected to Stripe's hosted onboarding via createOnboardingLink()
 *   3. After completing KYC + bank, Stripe redirects back to our app
 *   4. We re-fetch account state via retrieveAccount() to confirm charges/payouts enabled
 *   5. On each booking payment, we create a Transfer to the connected account
 */
export class StripeConnectService {
  /**
   * Create a Standard or Express connected account.
   * We use 'express' — Stripe handles all KYC UI; we just collect basic info.
   */
  static async createConnectAccount(
    input: CreateConnectAccountInput,
  ): Promise<Stripe.Account> {
    try {
      const account = await stripe.accounts.create({
        type: 'express',
        country: input.country || 'US',
        email: input.email,
        business_profile: input.businessName
          ? { name: input.businessName }
          : undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { vendorId: input.vendorId },
      });
      logger.info(`[StripeConnect] Created account ${account.id} for vendor ${input.vendorId}`);
      return account;
    } catch (err: any) {
      logger.error(`[StripeConnect] Failed to create account: ${err.message}`);
      throw new Error(`Stripe Connect onboarding failed: ${err.message}`);
    }
  }

  /**
   * Create a one-time onboarding URL — the vendor visits this to complete KYC.
   * The URL expires in ~5 minutes; vendors who close it must request a new one.
   */
  static async createOnboardingLink(
    input: OnboardingLinkInput,
  ): Promise<Stripe.AccountLink> {
    try {
      const link = await stripe.accountLinks.create({
        account: input.stripeConnectAccountId,
        refresh_url: input.refreshUrl,
        return_url: input.returnUrl,
        type: 'account_onboarding',
      });
      return link;
    } catch (err: any) {
      logger.error(`[StripeConnect] Failed to create onboarding link: ${err.message}`);
      throw new Error(`Stripe onboarding link failed: ${err.message}`);
    }
  }

  /**
   * Re-fetch account state from Stripe to learn whether charges/payouts are enabled.
   * Call this after the vendor returns from Stripe's onboarding flow.
   */
  static async retrieveAccount(
    stripeConnectAccountId: string,
  ): Promise<Stripe.Account> {
    return stripe.accounts.retrieve(stripeConnectAccountId);
  }

  /**
   * Create a login link so the vendor can access their Stripe Express dashboard
   * (view payouts, update bank account, see balance, etc.).
   */
  static async createLoginLink(stripeConnectAccountId: string): Promise<Stripe.LoginLink> {
    return stripe.accounts.createLoginLink(stripeConnectAccountId);
  }

  /**
   * Transfer funds from the platform's Stripe balance to a vendor's connected account.
   * Called after a successful customer payment when funds are available.
   *
   * @param amount - in cents (e.g. 5000 for $50.00)
   * @param destinationAccount - vendor's acct_xxx
   * @param sourcePaymentIntent - the customer's PI that produced these funds
   */
  static async transferToVendor(input: {
    amount: number;
    destinationAccount: string;
    sourcePaymentIntent?: string;
    metadata?: Record<string, string>;
    idempotencyKey?: string;
  }): Promise<Stripe.Transfer> {
    try {
      const options: Stripe.RequestOptions = {};
      if (input.idempotencyKey) {
        options.idempotencyKey = `tr_${input.idempotencyKey}`;
      }
      const transfer = await stripe.transfers.create(
        {
          amount: Math.round(input.amount),
          currency: 'usd',
          destination: input.destinationAccount,
          source_transaction: input.sourcePaymentIntent as any,
          metadata: input.metadata || {},
        },
        options,
      );
      logger.info(
        `[StripeConnect] Transferred ${input.amount} to ${input.destinationAccount} (transfer ${transfer.id})`,
      );
      return transfer;
    } catch (err: any) {
      logger.error(`[StripeConnect] Transfer failed: ${err.message}`);
      throw new Error(`Vendor payout failed: ${err.message}`);
    }
  }

  /**
   * Reverse a transfer — used when refunding a customer that already had funds
   * sent to the vendor. The amount is pulled back from the vendor's balance.
   */
  static async reverseTransfer(transferId: string, amount?: number): Promise<Stripe.TransferReversal> {
    return stripe.transfers.createReversal(transferId, amount ? { amount } : undefined);
  }
}
