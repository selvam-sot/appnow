import type { Request, Response } from 'express';
import Promotion from '../models/promotion.model';
import VendorService from '../models/vendor-service.model';
import mongoose from 'mongoose';

/**
 * Get all promotions (Admin)
 * @route GET /api/admin/promotions
 */
export const getAllPromotions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { isActive, showInBanner, isFeatured } = req.query;

    const filter: Record<string, any> = {};

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    if (showInBanner !== undefined) {
      filter.showInBanner = showInBanner === 'true';
    }

    if (isFeatured !== undefined) {
      filter.isFeatured = isFeatured === 'true';
    }

    const promotions = await Promotion.find(filter).sort({ displayOrder: 1 });

    res.status(200).json({
      success: true,
      count: promotions.length,
      data: promotions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

/**
 * Get single promotion
 * @route GET /api/admin/promotions/:id
 */
export const getPromotion = async (req: Request, res: Response): Promise<void> => {
  try {
    const promotion = await Promotion.findById(req.params.id);

    if (!promotion) {
      res.status(404).json({
        success: false,
        error: 'Promotion not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: promotion,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

/**
 * Create new promotion
 * @route POST /api/admin/promotions
 */
export const createPromotion = async (req: Request, res: Response): Promise<void> => {
  try {
    const promotion = await Promotion.create(req.body);

    res.status(201).json({
      success: true,
      data: promotion,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ValidationError') {
      const messages = Object.values((error as any).errors).map((val) => (val as any).message);
      res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: messages.join(', '),
      });
    } else if (error instanceof Error && error.message.includes('duplicate key error')) {
      res.status(400).json({
        success: false,
        error: 'Duplicate Entry',
        message: 'A promotion with this code already exists',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Server Error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  }
};

/**
 * Update promotion
 * @route PUT /api/admin/promotions/:id
 */
export const updatePromotion = async (req: Request, res: Response): Promise<void> => {
  try {
    const promotion = await Promotion.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!promotion) {
      res.status(404).json({
        success: false,
        error: 'Promotion not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: promotion,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('duplicate key error')) {
      res.status(400).json({
        success: false,
        error: 'Duplicate Entry',
        message: 'A promotion with this code already exists',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Server Error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  }
};

/**
 * Delete promotion
 * @route DELETE /api/admin/promotions/:id
 */
export const deletePromotion = async (req: Request, res: Response): Promise<void> => {
  try {
    const promotion = await Promotion.findByIdAndDelete(req.params.id);

    if (!promotion) {
      res.status(404).json({
        success: false,
        error: 'Promotion not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

/**
 * Toggle active status
 * @route PATCH /api/admin/promotions/:id/toggle-active
 */
export const toggleActive = async (req: Request, res: Response): Promise<void> => {
  try {
    const promotion = await Promotion.findById(req.params.id);

    if (!promotion) {
      res.status(404).json({
        success: false,
        error: 'Promotion not found',
      });
      return;
    }

    promotion.isActive = !promotion.isActive;
    await promotion.save();

    res.status(200).json({
      success: true,
      data: promotion,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

/**
 * Toggle featured status
 * @route PATCH /api/admin/promotions/:id/toggle-featured
 */
export const toggleFeatured = async (req: Request, res: Response): Promise<void> => {
  try {
    const promotion = await Promotion.findById(req.params.id);

    if (!promotion) {
      res.status(404).json({
        success: false,
        error: 'Promotion not found',
      });
      return;
    }

    promotion.isFeatured = !promotion.isFeatured;
    await promotion.save();

    res.status(200).json({
      success: true,
      data: promotion,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

/**
 * Toggle banner visibility
 * @route PATCH /api/admin/promotions/:id/toggle-banner
 */
export const toggleBanner = async (req: Request, res: Response): Promise<void> => {
  try {
    const promotion = await Promotion.findById(req.params.id);

    if (!promotion) {
      res.status(404).json({
        success: false,
        error: 'Promotion not found',
      });
      return;
    }

    promotion.showInBanner = !promotion.showInBanner;
    await promotion.save();

    res.status(200).json({
      success: true,
      data: promotion,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

/**
 * Reorder promotions (bulk update displayOrder)
 * @route PUT /api/admin/promotions/reorder
 */
export const reorderPromotions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { promotions } = req.body;

    if (!Array.isArray(promotions)) {
      res.status(400).json({
        success: false,
        error: 'Invalid request body. Expected array of promotions with _id and displayOrder.',
      });
      return;
    }

    // Bulk update each promotion's displayOrder
    const bulkOps = promotions.map((item: { _id: string; displayOrder: number }) => ({
      updateOne: {
        filter: { _id: item._id },
        update: { $set: { displayOrder: item.displayOrder } },
      },
    }));

    await Promotion.bulkWrite(bulkOps);

    res.status(200).json({
      success: true,
      message: 'Promotions reordered successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

// ==================== PUBLIC API ====================

/**
 * Get active promotions for users (banner promotions)
 * @route GET /api/promotions/banners
 */
export const getBannerPromotions = async (req: Request, res: Response): Promise<void> => {
  try {
    const promotions = await Promotion.find({
      isActive: true,
      showInBanner: true,
    })
      .select(
        'title subtitle description code discount gradient icon isNew isFeatured displayOrder',
      )
      .sort({ displayOrder: 1 })
      .limit(6);

    res.status(200).json({
      success: true,
      count: promotions.length,
      data: promotions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

/**
 * Get all active promotions for users (offers page)
 * @route GET /api/promotions
 */
export const getActivePromotions = async (req: Request, res: Response): Promise<void> => {
  try {
    const promotions = await Promotion.find({
      isActive: true,
    }).sort({ displayOrder: 1 });

    // Format validUntil for display
    const formattedPromotions = promotions.map((promo) => {
      const promoObj = promo.toObject();

      // Format valid until date for display
      const validUntil = new Date(promo.validUntil);
      const options: Intl.DateTimeFormatOptions = {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      };

      // Check if it's an ongoing/no-expiry promotion (far future date)
      const isOngoing = validUntil.getFullYear() > new Date().getFullYear() + 5;

      return {
        ...promoObj,
        validUntilFormatted: isOngoing
          ? 'No expiry'
          : validUntil.toLocaleDateString('en-US', options),
      };
    });

    res.status(200).json({
      success: true,
      count: formattedPromotions.length,
      data: formattedPromotions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

/**
 * Calculate discount amount based on promotion rules
 */
const calculateDiscount = (promotion: any, bookingAmount: number): number => {
  let discountAmount = 0;
  if (promotion.discountType === 'percentage') {
    discountAmount = bookingAmount * (promotion.discountValue / 100);
    if (promotion.maxDiscountAmount && discountAmount > promotion.maxDiscountAmount) {
      discountAmount = promotion.maxDiscountAmount;
    }
  } else {
    discountAmount = Math.min(promotion.discountValue, bookingAmount);
  }
  return Math.round(discountAmount * 100) / 100;
};

/**
 * Server-side validation helper used by both validatePromoCode (HTTP) and createAppointment
 * Returns { valid: true, promotion, discountAmount } or { valid: false, error }
 */
export const validatePromotionInternal = async (
  code: string,
  bookingAmount: number,
  vendorServiceId?: string,
): Promise<
  | { valid: true; promotion: any; discountAmount: number }
  | { valid: false; error: string }
> => {
  if (!code) return { valid: false, error: 'Promo code is required' };

  const promotion = await Promotion.findOne({ code: code.toUpperCase(), isActive: true });
  if (!promotion) return { valid: false, error: 'Invalid or expired promo code' };

  const now = new Date();
  if (promotion.validFrom && new Date(promotion.validFrom) > now) {
    return { valid: false, error: 'This promo code is not yet active' };
  }
  if (promotion.validUntil && new Date(promotion.validUntil) < now) {
    return { valid: false, error: 'This promo code has expired' };
  }
  if (promotion.usageLimit && promotion.usageCount >= promotion.usageLimit) {
    return { valid: false, error: 'This promo code has reached its usage limit' };
  }
  if (promotion.minBookingValue && bookingAmount < promotion.minBookingValue) {
    return {
      valid: false,
      error: `Minimum booking value of $${promotion.minBookingValue} required`,
    };
  }

  // Scope checks
  if (vendorServiceId) {
    const vendorService = await VendorService.findById(vendorServiceId).select(
      'vendorId categoryId',
    );
    if (vendorService) {
      // Vendor-scoped coupon must match this service's vendor
      if (
        promotion.scope === 'vendor' &&
        promotion.vendorId &&
        promotion.vendorId.toString() !== vendorService.vendorId?.toString()
      ) {
        return { valid: false, error: 'This coupon is not valid for this vendor' };
      }
      // Service-restricted coupon
      if (
        Array.isArray(promotion.applicableServices) &&
        promotion.applicableServices.length > 0 &&
        !promotion.applicableServices.some(
          (id: any) => id.toString() === vendorServiceId.toString(),
        )
      ) {
        return { valid: false, error: 'This coupon is not applicable to this service' };
      }
      // Category-restricted coupon
      if (
        Array.isArray(promotion.applicableCategories) &&
        promotion.applicableCategories.length > 0 &&
        vendorService.categoryId &&
        !promotion.applicableCategories.some(
          (id: any) => id.toString() === vendorService.categoryId?.toString(),
        )
      ) {
        return { valid: false, error: 'This coupon is not applicable to this category' };
      }
    }
  }

  const discountAmount = calculateDiscount(promotion, bookingAmount);
  return { valid: true, promotion, discountAmount };
};

/**
 * Validate a promo code
 * @route POST /api/promotions/validate
 */
export const validatePromoCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, bookingAmount, vendorServiceId } = req.body;

    const result = await validatePromotionInternal(
      code,
      Number(bookingAmount) || 0,
      vendorServiceId,
    );

    if (!result.valid) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        isValid: true,
        promotion: {
          _id: result.promotion._id,
          title: result.promotion.title,
          code: result.promotion.code,
          discount: result.promotion.discount,
          discountType: result.promotion.discountType,
          discountValue: result.promotion.discountValue,
        },
        discountAmount: result.discountAmount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

/**
 * Get applicable coupons for a specific vendor service
 * @route GET /api/promotions/applicable/:vendorServiceId
 * Returns all active coupons that can be applied to the given service
 */
export const getApplicableCoupons = async (req: Request, res: Response): Promise<void> => {
  try {
    const { vendorServiceId } = req.params;
    const { amount } = req.query;
    const bookingAmount = Number(amount) || 0;

    const vendorService = await VendorService.findById(vendorServiceId)
      .select('vendorId categoryId subCategoryId')
      .lean();

    if (!vendorService) {
      res.status(404).json({ success: false, error: 'Service not found' });
      return;
    }

    const now = new Date();
    const orFilters: any[] = [
      // Platform-wide coupons (no scope set = legacy = treated as platform)
      {
        $and: [
          // scope is 'platform' OR not set (legacy promotions before scope was added)
          {
            $or: [
              { scope: 'platform' },
              { scope: { $exists: false } },
              { scope: null },
            ],
          },
          {
            $or: [
              { applicableServices: { $size: 0 } },
              { applicableServices: { $exists: false } },
              { applicableServices: new mongoose.Types.ObjectId(vendorServiceId) },
            ],
          },
          {
            $or: [
              { applicableCategories: { $size: 0 } },
              { applicableCategories: { $exists: false } },
              ...(vendorService.categoryId
                ? [{ applicableCategories: vendorService.categoryId }]
                : []),
            ],
          },
        ],
      },
      // Vendor-specific coupons for this vendor
      ...(vendorService.vendorId
        ? [{ scope: 'vendor', vendorId: vendorService.vendorId }]
        : []),
    ];

    const promotions = await Promotion.find({
      isActive: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now },
      $or: orFilters,
    })
      .sort({ displayOrder: 1, discountValue: -1 })
      .lean();

    // Filter out coupons that exceeded usage limit or where booking amount is too low
    const applicable = promotions
      .filter((p: any) => {
        if (p.usageLimit && p.usageCount >= p.usageLimit) return false;
        if (p.minBookingValue && bookingAmount > 0 && bookingAmount < p.minBookingValue)
          return false;
        return true;
      })
      .map((p: any) => ({
        _id: p._id,
        code: p.code,
        title: p.title,
        subtitle: p.subtitle,
        description: p.description,
        discount: p.discount,
        discountType: p.discountType,
        discountValue: p.discountValue,
        minBookingValue: p.minBookingValue || 0,
        maxDiscountAmount: p.maxDiscountAmount,
        validUntil: p.validUntil,
        terms: p.terms,
        gradient: p.gradient,
        icon: p.icon,
        scope: p.scope,
        estimatedDiscount: bookingAmount > 0 ? calculateDiscount(p, bookingAmount) : null,
      }));

    res.status(200).json({
      success: true,
      count: applicable.length,
      data: applicable,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

/**
 * Get the best discount available for a service (used for badges on cards)
 * @route GET /api/promotions/best-discount/:vendorServiceId
 */
export const getBestDiscountForService = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { vendorServiceId } = req.params;

    const vendorService = await VendorService.findById(vendorServiceId)
      .select('vendorId categoryId price')
      .lean();

    if (!vendorService) {
      res.status(404).json({ success: false, error: 'Service not found' });
      return;
    }

    const now = new Date();
    const promotions = await Promotion.find({
      isActive: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now },
      $or: [
        // Platform-wide coupons (scope='platform' OR legacy promotions without scope)
        { scope: 'platform' },
        { scope: { $exists: false } },
        { scope: null },
        ...(vendorService.vendorId
          ? [{ scope: 'vendor', vendorId: vendorService.vendorId }]
          : []),
      ],
    }).lean();

    const price = vendorService.price || 0;
    let best: { code: string; label: string; discountAmount: number } | null = null;

    for (const p of promotions as any[]) {
      // Skip service/category-restricted coupons that don't match
      if (
        Array.isArray(p.applicableServices) &&
        p.applicableServices.length > 0 &&
        !p.applicableServices.some((id: any) => id.toString() === vendorServiceId)
      )
        continue;
      if (
        Array.isArray(p.applicableCategories) &&
        p.applicableCategories.length > 0 &&
        vendorService.categoryId &&
        !p.applicableCategories.some(
          (id: any) => id.toString() === vendorService.categoryId?.toString(),
        )
      )
        continue;
      if (p.minBookingValue && price < p.minBookingValue) continue;
      if (p.usageLimit && p.usageCount >= p.usageLimit) continue;

      const discountAmount = calculateDiscount(p, price);
      if (!best || discountAmount > best.discountAmount) {
        best = {
          code: p.code,
          label: p.discount,
          discountAmount,
        };
      }
    }

    res.status(200).json({
      success: true,
      data: best,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

/**
 * Apply a promo code (increment usage count)
 * @route POST /api/promotions/apply
 */
export const applyPromoCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.body;

    if (!code) {
      res.status(400).json({
        success: false,
        error: 'Promo code is required',
      });
      return;
    }

    const promotion = await Promotion.findOneAndUpdate(
      { code: code.toUpperCase(), isActive: true },
      { $inc: { usageCount: 1 } },
      { new: true },
    );

    if (!promotion) {
      res.status(404).json({
        success: false,
        error: 'Promo code not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Promo code applied successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};
