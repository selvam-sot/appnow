import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.util';
import { AppError } from '../utils/appError.util';
import Vendor from '../models/vendor.model';
import VendorPayout from '../models/vendor-payout.model';
import { StripeConnectService } from '../services/stripe-connect.service';

/**
 * Start (or resume) Stripe Connect onboarding for the authenticated vendor.
 * Returns a one-time onboarding URL that the vendor should open in a webview/browser.
 *
 * POST /api/v1/vendor/stripe-connect/onboard
 * Body: { returnUrl: string, refreshUrl: string }
 */
export const startStripeConnectOnboarding = asyncHandler(
  async (req: Request, res: Response) => {
    const vendorId = req.vendorId!;
    const { returnUrl, refreshUrl } = req.body;

    if (!returnUrl || !refreshUrl) {
      throw new AppError('returnUrl and refreshUrl are required', 400);
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      throw new AppError('Vendor not found', 404);
    }

    // Create the Stripe Connect account if vendor doesn't have one yet
    let stripeAccountId = (vendor as any).stripeConnectAccountId as string | null;
    if (!stripeAccountId) {
      const account = await StripeConnectService.createConnectAccount({
        vendorId: vendor._id.toString(),
        email: (vendor as any).email,
        businessName: (vendor as any).vendorName,
        country: (vendor as any).stripeCountry || 'US',
      });
      stripeAccountId = account.id;
      (vendor as any).stripeConnectAccountId = stripeAccountId;
      await vendor.save();
    }

    // Issue a one-time onboarding URL
    const link = await StripeConnectService.createOnboardingLink({
      stripeConnectAccountId: stripeAccountId,
      refreshUrl,
      returnUrl,
    });

    res.status(200).json({
      success: true,
      data: {
        url: link.url,
        expiresAt: link.expires_at,
        stripeConnectAccountId: stripeAccountId,
      },
    });
  },
);

/**
 * Re-sync the vendor's Stripe Connect status. Call this after the vendor
 * completes (or returns from) the Stripe onboarding flow.
 *
 * GET /api/v1/vendor/stripe-connect/status
 */
export const getStripeConnectStatus = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = req.vendorId!;
  const vendor = await Vendor.findById(vendorId);
  if (!vendor) throw new AppError('Vendor not found', 404);

  const stripeAccountId = (vendor as any).stripeConnectAccountId as string | null;
  if (!stripeAccountId) {
    return res.status(200).json({
      success: true,
      data: {
        onboarded: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        stripeConnectAccountId: null,
      },
    });
  }

  const account = await StripeConnectService.retrieveAccount(stripeAccountId);
  const onboardingCompleted = account.details_submitted === true;
  const chargesEnabled = account.charges_enabled === true;
  const payoutsEnabled = account.payouts_enabled === true;

  // Persist current state so we don't need to hit Stripe on every read
  (vendor as any).stripeOnboardingCompleted = onboardingCompleted;
  (vendor as any).stripeChargesEnabled = chargesEnabled;
  (vendor as any).stripePayoutsEnabled = payoutsEnabled;
  await vendor.save();

  res.status(200).json({
    success: true,
    data: {
      onboarded: onboardingCompleted,
      chargesEnabled,
      payoutsEnabled,
      stripeConnectAccountId: stripeAccountId,
      requirements: account.requirements?.currently_due || [],
    },
  });
});

/**
 * Generate a Stripe Express dashboard login link so the vendor can manage
 * their bank account, view balance, etc.
 *
 * GET /api/v1/vendor/stripe-connect/dashboard-link
 */
export const getStripeDashboardLink = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = req.vendorId!;
  const vendor = await Vendor.findById(vendorId);
  const stripeAccountId = (vendor as any)?.stripeConnectAccountId as string | null;
  if (!stripeAccountId) {
    throw new AppError('Vendor has not started Stripe Connect onboarding', 400);
  }

  const link = await StripeConnectService.createLoginLink(stripeAccountId);
  res.status(200).json({ success: true, data: { url: link.url } });
});

/**
 * List the vendor's payouts with pagination.
 *
 * GET /api/v1/vendor/payouts?page=1&limit=20&status=paid
 */
export const listVendorPayouts = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = req.vendorId!;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const status = req.query.status as string | undefined;

  const filter: any = { vendorId };
  if (status) filter.status = status;

  const [payouts, total] = await Promise.all([
    VendorPayout.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    VendorPayout.countDocuments(filter),
  ]);

  // Aggregate summary grouped by status
  const summary = await VendorPayout.aggregate([
    { $match: { vendorId: new mongoose.Types.ObjectId(vendorId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        amount: { $sum: '$netAmount' },
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: {
      payouts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      summary,
    },
  });
});
