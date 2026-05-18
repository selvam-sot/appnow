import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.util';
import { AppError } from '../utils/appError.util';
import Promotion from '../models/promotion.model';
import VendorService from '../models/vendor-service.model';

/**
 * Get all coupons created by the authenticated vendor
 * GET /api/v1/vendor/coupons
 */
export const getVendorCoupons = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = req.vendorId!;
  const { isActive } = req.query;

  const filter: any = {
    scope: 'vendor',
    vendorId,
    createdBy: 'vendor',
  };
  if (isActive !== undefined) {
    filter.isActive = isActive === 'true';
  }

  const coupons = await Promotion.find(filter).sort({ createdAt: -1 }).lean();

  res.status(200).json({
    success: true,
    count: coupons.length,
    data: coupons,
  });
});

/**
 * Get a single vendor coupon by ID
 * GET /api/v1/vendor/coupons/:id
 */
export const getVendorCouponById = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = req.vendorId!;
  const coupon = await Promotion.findOne({
    _id: req.params.id,
    scope: 'vendor',
    vendorId,
  });

  if (!coupon) {
    throw new AppError('Coupon not found', 404);
  }

  res.status(200).json({ success: true, data: coupon });
});

/**
 * Create a new vendor coupon
 * POST /api/v1/vendor/coupons
 */
export const createVendorCoupon = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = req.vendorId!;
  const {
    code,
    title,
    subtitle,
    description,
    discountType,
    discountValue,
    minBookingValue,
    maxDiscountAmount,
    validFrom,
    validUntil,
    terms,
    applicableServices,
    usageLimit,
    isActive = true,
  } = req.body;

  if (!code || !title || !discountType || discountValue === undefined || !validUntil) {
    throw new AppError('Missing required fields', 400);
  }

  // Validate that applicableServices (if provided) all belong to this vendor
  if (Array.isArray(applicableServices) && applicableServices.length > 0) {
    const ownedServices = await VendorService.find({
      _id: { $in: applicableServices },
      vendorId,
    }).select('_id');

    if (ownedServices.length !== applicableServices.length) {
      throw new AppError('Some services do not belong to your account', 400);
    }
  }

  // Build display strings
  const discountLabel =
    discountType === 'percentage' ? `${discountValue}% off` : `$${discountValue} off`;

  const couponData: any = {
    code: code.toUpperCase(),
    title,
    subtitle: subtitle || discountLabel,
    description: description || `${discountLabel} on your booking`,
    discount: discountLabel,
    discountType,
    discountValue: Number(discountValue),
    minBookingValue: minBookingValue || 0,
    maxDiscountAmount: maxDiscountAmount || null,
    validFrom: validFrom ? new Date(validFrom) : new Date(),
    validUntil: new Date(validUntil),
    terms: Array.isArray(terms) ? terms : [],
    gradient: ['#00587A', '#0080AA'],
    icon: 'pricetag-outline',
    isActive,
    scope: 'vendor',
    vendorId,
    createdBy: 'vendor',
    applicableServices: applicableServices || [],
    usageLimit: usageLimit || null,
    showInBanner: false,
    isFeatured: false,
    displayOrder: 0,
  };

  try {
    const coupon = await Promotion.create(couponData);
    res.status(201).json({ success: true, data: coupon });
  } catch (error: any) {
    if (error.code === 11000) {
      throw new AppError('A coupon with this code already exists', 400);
    }
    throw error;
  }
});

/**
 * Update a vendor coupon
 * PUT /api/v1/vendor/coupons/:id
 */
export const updateVendorCoupon = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = req.vendorId!;

  // Only allow updating fields that vendor owns
  const allowedFields = [
    'title',
    'subtitle',
    'description',
    'discountType',
    'discountValue',
    'minBookingValue',
    'maxDiscountAmount',
    'validFrom',
    'validUntil',
    'terms',
    'applicableServices',
    'usageLimit',
    'isActive',
  ];

  const updates: any = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  // Re-validate service ownership if applicableServices is being updated
  if (Array.isArray(updates.applicableServices) && updates.applicableServices.length > 0) {
    const ownedServices = await VendorService.find({
      _id: { $in: updates.applicableServices },
      vendorId,
    }).select('_id');

    if (ownedServices.length !== updates.applicableServices.length) {
      throw new AppError('Some services do not belong to your account', 400);
    }
  }

  // Refresh display string if discount values changed
  if (updates.discountType || updates.discountValue !== undefined) {
    const existing = await Promotion.findOne({ _id: req.params.id, scope: 'vendor', vendorId });
    if (existing) {
      const type = updates.discountType || existing.discountType;
      const value = updates.discountValue ?? existing.discountValue;
      updates.discount = type === 'percentage' ? `${value}% off` : `$${value} off`;
    }
  }

  const coupon = await Promotion.findOneAndUpdate(
    { _id: req.params.id, scope: 'vendor', vendorId },
    updates,
    { new: true, runValidators: true },
  );

  if (!coupon) {
    throw new AppError('Coupon not found', 404);
  }

  res.status(200).json({ success: true, data: coupon });
});

/**
 * Toggle coupon active status
 * PATCH /api/v1/vendor/coupons/:id/toggle-active
 */
export const toggleVendorCouponActive = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = req.vendorId!;
  const coupon = await Promotion.findOne({
    _id: req.params.id,
    scope: 'vendor',
    vendorId,
  });

  if (!coupon) {
    throw new AppError('Coupon not found', 404);
  }

  coupon.isActive = !coupon.isActive;
  await coupon.save();

  res.status(200).json({ success: true, data: coupon });
});

/**
 * Delete a vendor coupon
 * DELETE /api/v1/vendor/coupons/:id
 */
export const deleteVendorCoupon = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = req.vendorId!;
  const coupon = await Promotion.findOneAndDelete({
    _id: req.params.id,
    scope: 'vendor',
    vendorId,
  });

  if (!coupon) {
    throw new AppError('Coupon not found', 404);
  }

  res.status(200).json({ success: true, message: 'Coupon deleted successfully' });
});
