import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.util';
import { AppError } from '../utils/appError.util';
import User from '../models/user.model';
import WalletTransaction from '../models/wallet-transaction.model';
import StripeService from '../services/stripe.service';
import logger from '../config/logger';

/**
 * Customer wallet endpoints.
 *
 * - `GET /customer/wallet` — balance + recent transactions
 * - `POST /customer/wallet/apply-to-payment` — reduce a Stripe PaymentIntent
 *   by the customer's chosen wallet amount and debit their ledger. Called
 *   after `createPaymentIntent` but before `presentPaymentSheet`.
 *
 * User is identified via the `x-clerk-id` header set by the API wrapper
 * (same pattern as the address-book endpoints).
 */

const resolveUser = async (req: Request) => {
  const clerkId =
    (req.headers['x-clerk-id'] as string | undefined) ||
    (req.query.clerkId as string | undefined) ||
    (req.body && req.body.clerkId);
  if (!clerkId) throw new AppError('Missing clerkId', 401);
  const dbUser = await User.findOne({ clerkId });
  if (!dbUser) throw new AppError('User not found', 404);
  return dbUser;
};

/** GET /customer/wallet */
export const getWallet = asyncHandler(async (req: Request, res: Response) => {
  const user = await resolveUser(req);
  const transactions = await WalletTransaction.find({ userId: user._id })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  res.status(200).json({
    success: true,
    data: {
      balance: (user as any).walletBalance || 0,
      recentTransactions: transactions,
    },
  });
});

/**
 * POST /customer/wallet/apply-to-payment
 * Body: { amount, paymentIntentId }
 *
 * Reduces the Stripe PaymentIntent by `amount` (or the user's full balance,
 * whichever is smaller), debits the wallet, and returns the new charge amount.
 * Safe to retry — verifies the PaymentIntent is still modifiable.
 */
export const applyWalletToPayment = asyncHandler(async (req: Request, res: Response) => {
  const user = await resolveUser(req);
  const { amount, paymentIntentId } = req.body as {
    amount?: number;
    paymentIntentId?: string;
  };

  if (!amount || amount <= 0) throw new AppError('Amount must be positive', 400);
  if (!paymentIntentId) throw new AppError('paymentIntentId is required', 400);

  const balance = (user as any).walletBalance || 0;
  if (balance <= 0) throw new AppError('Wallet balance is zero', 400);

  // Fetch the current PaymentIntent
  const intent = await StripeService.retrievePaymentIntent(paymentIntentId);
  if (
    intent.status !== 'requires_payment_method' &&
    intent.status !== 'requires_confirmation'
  ) {
    throw new AppError(
      `PaymentIntent is not modifiable (status: ${intent.status})`,
      400,
    );
  }
  if (intent.metadata?.clerkUserId && intent.metadata.clerkUserId !== user.clerkId) {
    throw new AppError('PaymentIntent does not belong to this user', 403);
  }

  // Cap the applied amount at the balance and at the intent total.
  // Stripe amounts are in cents.
  const intentAmountDollars = intent.amount / 100;
  const applied = Math.min(amount, balance, intentAmountDollars - 0.5);
  // Keep at least $0.50 as the Stripe minimum charge — smaller and Stripe rejects.
  if (applied <= 0) {
    throw new AppError('Insufficient charge amount to apply credit', 400);
  }

  const newAmountCents = Math.round((intentAmountDollars - applied) * 100);

  // Update the PaymentIntent to the reduced amount
  await StripeService.updatePaymentIntent(paymentIntentId, {
    amount: newAmountCents,
    metadata: {
      ...intent.metadata,
      walletAmountApplied: applied.toFixed(2),
    },
  });

  // Atomically deduct from the user's wallet and record the transaction
  const balanceAfter = Math.round((balance - applied) * 100) / 100;
  (user as any).walletBalance = balanceAfter;
  await user.save();

  const tx = await WalletTransaction.create({
    userId: user._id,
    type: 'debit',
    amount: applied,
    reason: 'appointment_payment',
    note: `Applied to PaymentIntent ${paymentIntentId}`,
    balanceAfter,
  });

  logger.info(
    `[Wallet] User ${user.email} applied $${applied.toFixed(2)} to payment ${paymentIntentId}. New balance: $${balanceAfter.toFixed(2)}`,
  );

  res.status(200).json({
    success: true,
    data: {
      applied,
      newChargeAmount: newAmountCents / 100,
      walletBalanceAfter: balanceAfter,
      transactionId: tx._id,
    },
  });
});
