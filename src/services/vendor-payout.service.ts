import logger from '../config/logger';
import VendorPayout from '../models/vendor-payout.model';
import Vendor from '../models/vendor.model';
import VendorService from '../models/vendor-service.model';
import Appointment from '../models/appointment.model';
import { StripeConnectService } from './stripe-connect.service';

/**
 * Record (and optionally execute) a vendor payout for a paid appointment.
 *
 * Splits the customer payment into:
 *   - grossAmount  → service price (excluding tax)
 *   - platformFee  → commission % of gross
 *   - taxAmount    → sales tax (collected, not paid to vendor)
 *   - netAmount    → gross - platformFee → wired to vendor
 *
 * Returns the created payout document (status='pending').
 * The actual Stripe Transfer happens via the webhook queue / cron.
 */
export async function recordPayoutForAppointment(
  appointmentId: string,
): Promise<void> {
  const appointment = await Appointment.findById(appointmentId).lean();
  if (!appointment) {
    logger.warn(`[VendorPayout] Appointment ${appointmentId} not found`);
    return;
  }

  // Avoid creating duplicate payouts for the same appointment
  const existing = await VendorPayout.findOne({ appointmentId });
  if (existing) {
    logger.info(`[VendorPayout] Payout already exists for appointment ${appointmentId}`);
    return;
  }

  // Resolve vendorId via vendor-service
  const vendorService = await VendorService.findById(
    appointment.vendorServiceId,
  ).select('vendorId').lean();
  if (!vendorService) {
    logger.warn(`[VendorPayout] VendorService ${appointment.vendorServiceId} not found`);
    return;
  }

  const vendor = await Vendor.findById(vendorService.vendorId).lean();
  if (!vendor) {
    logger.warn(`[VendorPayout] Vendor ${vendorService.vendorId} not found`);
    return;
  }

  // Amounts in cents (matches Stripe convention)
  const grossAmount = Math.round((appointment.serviceFee || 0) * 100);
  const tipAmount = Math.round((appointment as any).tipAmount * 100 || 0);
  const taxAmount = Math.round((appointment as any).taxAmount * 100 || 0);
  const commissionRate = (vendor as any).commissionRate || 10;
  // Commission only on service fee, NOT on tip (vendor keeps 100% of tip)
  const platformFee = Math.round((grossAmount * commissionRate) / 100);
  const netAmount = Math.max(0, grossAmount - platformFee) + tipAmount;

  await VendorPayout.create({
    vendorId: vendor._id,
    appointmentId: appointment._id,
    grossAmount: grossAmount + tipAmount, // Gross paid to vendor (service + tip)
    platformFee,
    taxAmount,
    netAmount,
    currency: 'usd',
    status: 'pending',
    stripePaymentIntentId: appointment.paymentIntentId,
  });

  logger.info(
    `[VendorPayout] Recorded payout for appointment ${appointmentId}: gross=${grossAmount} tip=${tipAmount} fee=${platformFee} net=${netAmount}`,
  );
}

/**
 * Process a pending payout — actually transfer funds to the vendor.
 * Called by webhook worker / cron after the customer payment clears.
 */
export async function processPayoutTransfer(payoutId: string): Promise<void> {
  const payout = await VendorPayout.findById(payoutId);
  if (!payout || payout.status !== 'pending') return;

  const vendor = await Vendor.findById(payout.vendorId);
  if (!vendor) {
    payout.status = 'failed';
    payout.failureReason = 'Vendor not found';
    payout.failedAt = new Date();
    await payout.save();
    return;
  }

  const stripeAccountId = (vendor as any).stripeConnectAccountId as string | null;
  if (!stripeAccountId || !(vendor as any).stripePayoutsEnabled) {
    payout.status = 'failed';
    payout.failureReason = 'Vendor has not completed Stripe Connect onboarding';
    payout.failedAt = new Date();
    await payout.save();
    logger.warn(`[VendorPayout] Payout ${payoutId} failed — vendor ${vendor._id} not onboarded`);
    return;
  }

  try {
    const transfer = await StripeConnectService.transferToVendor({
      amount: payout.netAmount,
      destinationAccount: stripeAccountId,
      sourcePaymentIntent: payout.stripePaymentIntentId,
      idempotencyKey: payout._id.toString(),
      metadata: {
        vendorId: vendor._id.toString(),
        appointmentId: payout.appointmentId?.toString() || '',
      },
    });
    payout.stripeTransferId = transfer.id;
    payout.status = 'in_transit';
    await payout.save();
    logger.info(`[VendorPayout] Payout ${payoutId} transferred via ${transfer.id}`);
  } catch (err: any) {
    payout.status = 'failed';
    payout.failureReason = err?.message || 'unknown error';
    payout.failedAt = new Date();
    await payout.save();
    logger.error(`[VendorPayout] Payout ${payoutId} transfer failed: ${err?.message}`);
  }
}
