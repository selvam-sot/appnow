import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.util';
import { AppError } from '../utils/appError.util';
import User from '../models/user.model';
import Appointment from '../models/appointment.model';
import Review from '../models/review.model';
import Notification from '../models/notification.model';
import logger from '../config/logger';

/**
 * CCPA / state privacy law compliance endpoints.
 * Lets a user export ALL their data and delete their account.
 *
 * Required for California (CCPA), Virginia (VCDPA), Colorado (CPA), Connecticut (CTDPA),
 * Utah (UCPA), and several others. All include the right to access + delete personal data.
 */

/**
 * GET /api/v1/customer/privacy/export
 * Returns a JSON dump of all data we hold for the authenticated user.
 *
 * Client should download this as a file (the response is `Content-Disposition: attachment`).
 */
export const exportUserData = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError('Not authenticated', 401);

  // Fetch all related records in parallel
  const [appointments, reviews, notifications] = await Promise.all([
    Appointment.find({ customerId: user._id }).lean(),
    Review.find({ customerId: user._id }).lean(),
    Notification.find({ userId: user._id }).lean(),
  ]);

  // Strip sensitive internal fields we shouldn't expose
  const userData = await User.findById(user._id)
    .select('-password -activationToken -tokenVersion -__v')
    .lean();

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    user: userData,
    appointments,
    reviews,
    notifications,
    _meta: {
      message:
        'This file contains all personal data we have associated with your account. ' +
        'If you have questions, contact support.',
    },
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="appointmentnow-data-${user._id}-${Date.now()}.json"`,
  );
  res.status(200).send(JSON.stringify(exportPayload, null, 2));
});

/**
 * POST /api/v1/customer/privacy/delete-account
 * Soft-deletes the account: marks deletedAt, scrubs PII, deactivates.
 *
 * Hard delete happens after a 30-day grace period via scheduled job (TODO).
 * Body: { confirmation: 'DELETE MY ACCOUNT' } — explicit confirmation required.
 */
export const deleteUserAccount = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError('Not authenticated', 401);

  const { confirmation } = req.body;
  if (confirmation !== 'DELETE MY ACCOUNT') {
    throw new AppError(
      'You must confirm deletion by sending { "confirmation": "DELETE MY ACCOUNT" } in the body',
      400,
    );
  }

  // Refuse if there are upcoming non-cancelled appointments — protects vendors
  const upcomingCount = await Appointment.countDocuments({
    customerId: user._id,
    appointmentDate: { $gte: new Date() },
    status: { $in: ['pending', 'confirmed'] },
  });

  if (upcomingCount > 0) {
    throw new AppError(
      `You have ${upcomingCount} upcoming appointment(s). Please cancel them before deleting your account.`,
      400,
    );
  }

  // Soft-delete: scrub PII but keep the row for legal/audit (e.g. 7-year retention on payments)
  const dbUser = await User.findById(user._id);
  if (!dbUser) throw new AppError('User not found', 404);

  const anonId = `deleted_${user._id}_${Date.now()}`;
  dbUser.firstName = '[deleted]';
  dbUser.lastName = '[user]';
  dbUser.email = `${anonId}@deleted.local`;
  (dbUser as any).phone = null;
  (dbUser as any).avatar = null;
  (dbUser as any).expoPushToken = null;
  (dbUser as any).clerkId = null;
  (dbUser as any).deletedAt = new Date();
  (dbUser as any).deletionRequestedAt = new Date();
  dbUser.isActive = false;
  await dbUser.save();

  logger.info(`[Privacy] Account ${user._id} soft-deleted (anonymized)`);

  res.status(200).json({
    success: true,
    message:
      'Your account has been deleted. We retain some payment records as required by law, but all personal information has been scrubbed.',
  });
});

/**
 * PUT /api/v1/customer/privacy/sms-consent
 * Update the user's SMS marketing consent (TCPA compliance).
 *
 * Body: { consent: true | false, method?: 'profile_toggle' }
 */
export const updateSmsConsent = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError('Not authenticated', 401);

  const { consent, method } = req.body;
  if (typeof consent !== 'boolean') {
    throw new AppError('consent (boolean) is required', 400);
  }

  const dbUser = await User.findById(user._id);
  if (!dbUser) throw new AppError('User not found', 404);

  (dbUser as any).smsConsent = consent;
  (dbUser as any).smsConsentAt = consent ? new Date() : null;
  (dbUser as any).smsConsentMethod = consent ? method || 'profile_toggle' : null;
  await dbUser.save();

  res.status(200).json({
    success: true,
    data: {
      smsConsent: (dbUser as any).smsConsent,
      smsConsentAt: (dbUser as any).smsConsentAt,
    },
  });
});

/**
 * PUT /api/v1/customer/privacy/email-consent
 * Update marketing email consent.
 */
export const updateEmailConsent = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError('Not authenticated', 401);

  const { consent } = req.body;
  if (typeof consent !== 'boolean') {
    throw new AppError('consent (boolean) is required', 400);
  }

  const dbUser = await User.findById(user._id);
  if (!dbUser) throw new AppError('User not found', 404);

  (dbUser as any).marketingEmailConsent = consent;
  (dbUser as any).marketingEmailConsentAt = consent ? new Date() : null;
  await dbUser.save();

  res.status(200).json({
    success: true,
    data: {
      marketingEmailConsent: (dbUser as any).marketingEmailConsent,
    },
  });
});
