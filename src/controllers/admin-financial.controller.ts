import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.util';
import { AppError } from '../utils/appError.util';
import User from '../models/user.model';
import Appointment from '../models/appointment.model';
import WalletTransaction from '../models/wallet-transaction.model';
import StripeService from '../services/stripe.service';
import { logAuditEvent } from '../middlewares/audit.middleware';
import logger from '../config/logger';

/**
 * Admin-initiated financial actions. Every action is audit-logged with
 * the admin's identity, and every wallet change writes to the
 * WalletTransaction ledger for reconciliation.
 */

/**
 * POST /admin/appointments/:id/refund
 * Body: { amount?, reason }
 * Admin issues a Stripe refund against the appointment's payment
 * intent. `amount` optional → full refund. `reason` required.
 */
export const adminIssueRefund = asyncHandler(async (req: Request, res: Response) => {
  const admin = (req as any).user;
  if (!admin?._id) throw new AppError('Admin session required', 401);

  const { id } = req.params;
  const { amount, reason } = req.body as { amount?: number; reason?: string };
  if (!reason || reason.trim().length < 5) {
    throw new AppError('A reason of at least 5 characters is required', 400);
  }

  const appointment = await Appointment.findById(id);
  if (!appointment) throw new AppError('Appointment not found', 404);
  if (!appointment.paymentIntentId) {
    throw new AppError('This appointment has no Stripe payment to refund', 400);
  }
  if (appointment.paymentStatus === 'refunded') {
    throw new AppError('This appointment has already been fully refunded', 400);
  }

  const refundAmount = amount ?? appointment.total ?? 0;
  if (refundAmount <= 0) throw new AppError('Refund amount must be positive', 400);
  if (refundAmount > (appointment.total ?? 0)) {
    throw new AppError('Refund amount cannot exceed the appointment total', 400);
  }
  const isFullRefund = refundAmount >= (appointment.total ?? 0);

  const refund = await StripeService.refundPayment(
    appointment.paymentIntentId,
    isFullRefund ? undefined : refundAmount,
  );

  appointment.refundId = refund.id;
  appointment.refundStatus =
    (refund.status as 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled') ||
    'pending';
  appointment.refundAmount = refund.amount ? refund.amount / 100 : refundAmount;
  appointment.paymentStatus = isFullRefund ? 'refunded' : 'partially_refunded';
  await appointment.save();

  await logAuditEvent('ADMIN_REFUND', 'appointment', {
    userId: String(admin._id),
    userEmail: admin.email,
    resourceId: String(appointment._id),
    metadata: {
      refundId: refund.id,
      amount: appointment.refundAmount,
      reason: reason.trim(),
      isFullRefund,
    },
  });

  logger.info(
    `[Admin] ${admin.email} issued $${appointment.refundAmount.toFixed(2)} refund on appointment ${id} — ${reason.trim()}`,
  );

  res.status(200).json({
    success: true,
    data: {
      refundId: refund.id,
      refundAmount: appointment.refundAmount,
      refundStatus: refund.status,
      isFullRefund,
    },
  });
});

/**
 * POST /admin/users/:id/wallet-credit
 * Body: { amount, reason, note? }
 * Adds store credit to the user's wallet balance and writes a ledger entry.
 */
export const adminAddWalletCredit = asyncHandler(async (req: Request, res: Response) => {
  const admin = (req as any).user;
  if (!admin?._id) throw new AppError('Admin session required', 401);

  const { id } = req.params;
  const { amount, reason, note } = req.body as {
    amount?: number;
    reason?: string;
    note?: string;
  };

  if (!amount || amount <= 0) throw new AppError('Amount must be positive', 400);
  if (!reason) throw new AppError('Reason is required', 400);

  const allowedReasons = [
    'goodwill',
    'refund_alternative',
    'promotional',
    'referral_reward',
    'admin_adjustment',
    'other',
  ];
  if (!allowedReasons.includes(reason)) {
    throw new AppError(`Reason must be one of: ${allowedReasons.join(', ')}`, 400);
  }

  const user = await User.findById(id);
  if (!user) throw new AppError('User not found', 404);

  const before = (user as any).walletBalance || 0;
  const after = Math.round((before + amount) * 100) / 100;
  (user as any).walletBalance = after;
  await user.save();

  const tx = await WalletTransaction.create({
    userId: user._id,
    type: 'credit',
    amount,
    reason,
    note,
    adminId: admin._id,
    balanceAfter: after,
  });

  await logAuditEvent('ADMIN_WALLET_CREDIT', 'user', {
    userId: String(admin._id),
    userEmail: admin.email,
    resourceId: String(user._id),
    metadata: {
      amount,
      reason,
      note,
      balanceBefore: before,
      balanceAfter: after,
      transactionId: String(tx._id),
    },
  });

  logger.info(
    `[Admin] ${admin.email} credited $${amount.toFixed(2)} to user ${user.email} (${reason})`,
  );

  res.status(200).json({
    success: true,
    data: {
      transactionId: tx._id,
      balanceBefore: before,
      balanceAfter: after,
      amount,
    },
  });
});

/**
 * GET /admin/users/:id/wallet-history
 * Returns the wallet transaction ledger for a user.
 */
export const adminGetWalletHistory = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { page = 1, limit = 25 } = req.query;
  const pageNum = parseInt(page as string, 10);
  const limitNum = Math.min(parseInt(limit as string, 10), 100);

  const user = await User.findById(id).select('walletBalance email name');
  if (!user) throw new AppError('User not found', 404);

  const [transactions, total] = await Promise.all([
    WalletTransaction.find({ userId: id })
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('adminId', 'email name')
      .lean(),
    WalletTransaction.countDocuments({ userId: id }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      user: {
        _id: user._id,
        email: user.email,
        name: (user as any).name,
        walletBalance: (user as any).walletBalance || 0,
      },
      transactions,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    },
  });
});
