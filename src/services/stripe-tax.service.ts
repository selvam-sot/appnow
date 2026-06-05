import Stripe from 'stripe';
import logger from '../config/logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * Stripe Tax service — calculates sales tax for US transactions.
 *
 * This is a thin wrapper around Stripe Tax. The real heavy lifting (state-level
 * tax rates, exempt categories, nexus tracking) is handled by Stripe Tax once
 * enabled in the Stripe dashboard.
 *
 * Prerequisites:
 *   1. Enable Stripe Tax in your Stripe Dashboard → Settings → Tax
 *   2. Register for tax collection in each state where you have nexus
 *   3. Add your business address to Stripe
 *
 * See: https://stripe.com/docs/tax/calculating
 */

export interface TaxCalculationInput {
  // Customer's billing/service address
  customerAddress: {
    line1?: string;
    city?: string;
    state?: string; // 2-letter US state code
    postalCode?: string;
    country?: string; // ISO2, default 'US'
  };
  // Line items being purchased (in cents)
  lineItems: Array<{
    amount: number;
    reference?: string; // e.g. vendorServiceId
    taxCode?: string; // Stripe tax product code (e.g. 'txcd_99999999' for default services)
  }>;
  currency?: string;
}

export interface TaxCalculationResult {
  // Stripe Tax Calculation ID — pass to PaymentIntent.tax_calculation
  calculationId: string;
  // Total tax amount in cents
  taxAmount: number;
  // Total amount including tax in cents
  totalAmount: number;
  // Per-line-item breakdown
  lineItems: Array<{
    reference?: string;
    amount: number;
    taxAmount: number;
  }>;
}

export class StripeTaxService {
  /**
   * Calculate tax for a transaction. Returns a calculation ID that must be
   * passed to the subsequent PaymentIntent to "lock in" the tax amount.
   *
   * If Stripe Tax is not enabled (or fails), returns zero-tax fallback so
   * the booking still works. Log + Sentry alert in that case.
   */
  static async calculateTax(input: TaxCalculationInput): Promise<TaxCalculationResult> {
    const currency = input.currency || 'usd';

    try {
      const calculation = await (stripe as any).tax.calculations.create({
        currency,
        line_items: input.lineItems.map((item) => ({
          amount: Math.round(item.amount),
          reference: item.reference || 'service',
          tax_code: item.taxCode || 'txcd_99999999', // General services
        })),
        customer_details: {
          address: {
            line1: input.customerAddress.line1,
            city: input.customerAddress.city,
            state: input.customerAddress.state,
            postal_code: input.customerAddress.postalCode,
            country: input.customerAddress.country || 'US',
          },
          address_source: 'billing',
        },
        expand: ['line_items'],
      });

      const lineItems = (calculation.line_items?.data || []).map((li: any) => ({
        reference: li.reference,
        amount: li.amount,
        taxAmount: li.amount_tax || 0,
      }));

      return {
        calculationId: calculation.id,
        taxAmount: calculation.tax_amount_exclusive || 0,
        totalAmount: calculation.amount_total || 0,
        lineItems,
      };
    } catch (err: any) {
      logger.error(`[StripeTax] Calculation failed: ${err?.message}. Falling back to zero tax.`);
      // Fallback: return zero tax so booking flow still succeeds.
      // Production should monitor this and fix Stripe Tax config.
      const totalLineAmount = input.lineItems.reduce((sum, li) => sum + li.amount, 0);
      return {
        calculationId: '',
        taxAmount: 0,
        totalAmount: totalLineAmount,
        lineItems: input.lineItems.map((li) => ({
          reference: li.reference,
          amount: li.amount,
          taxAmount: 0,
        })),
      };
    }
  }

  /**
   * After payment captures, call this to register the tax for filing.
   * Stripe Tax uses this to generate your tax filing reports.
   */
  static async createTaxTransaction(calculationId: string, reference: string): Promise<void> {
    if (!calculationId) return; // Fallback path — no calc to register
    try {
      await (stripe as any).tax.transactions.createFromCalculation({
        calculation: calculationId,
        reference,
      });
    } catch (err: any) {
      logger.error(`[StripeTax] createTaxTransaction failed: ${err?.message}`);
    }
  }
}
