import { Request, Response } from 'express';
import Promotion from '../models/promotion.model';

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
            const messages = Object.values((error as any).errors).map(val => (val as any).message);
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
        const promotion = await Promotion.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new: true,
                runValidators: true,
            }
        );

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
                update: { $set: { displayOrder: item.displayOrder } }
            }
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
        const now = new Date();

        const promotions = await Promotion.find({
            isActive: true,
            showInBanner: true,
            validFrom: { $lte: now },
            validUntil: { $gte: now }
        })
        .select('title subtitle description code discount gradient icon isNew isFeatured displayOrder')
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
        const now = new Date();

        const promotions = await Promotion.find({
            isActive: true,
            validFrom: { $lte: now },
            validUntil: { $gte: now }
        })
        .sort({ displayOrder: 1 });

        // Format validUntil for display
        const formattedPromotions = promotions.map(promo => {
            const promoObj = promo.toObject();

            // Format valid until date for display
            const validUntil = new Date(promo.validUntil);
            const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' };

            // Check if it's an ongoing/no-expiry promotion (far future date)
            const isOngoing = validUntil.getFullYear() > new Date().getFullYear() + 5;

            return {
                ...promoObj,
                validUntilFormatted: isOngoing ? 'No expiry' : validUntil.toLocaleDateString('en-US', options)
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
 * Validate a promo code
 * @route POST /api/promotions/validate
 */
export const validatePromoCode = async (req: Request, res: Response): Promise<void> => {
    try {
        const { code, bookingAmount } = req.body;

        if (!code) {
            res.status(400).json({
                success: false,
                error: 'Promo code is required',
            });
            return;
        }

        const now = new Date();

        const promotion = await Promotion.findOne({
            code: code.toUpperCase(),
            isActive: true,
            validFrom: { $lte: now },
            validUntil: { $gte: now }
        });

        if (!promotion) {
            res.status(404).json({
                success: false,
                error: 'Invalid or expired promo code',
            });
            return;
        }

        // Check usage limit
        if (promotion.usageLimit && promotion.usageCount >= promotion.usageLimit) {
            res.status(400).json({
                success: false,
                error: 'This promo code has reached its usage limit',
            });
            return;
        }

        // Check minimum booking value
        if (promotion.minBookingValue && bookingAmount && bookingAmount < promotion.minBookingValue) {
            res.status(400).json({
                success: false,
                error: `Minimum booking value of $${promotion.minBookingValue} required for this promo code`,
            });
            return;
        }

        // Calculate discount
        let discountAmount = 0;
        if (promotion.discountType === 'percentage') {
            discountAmount = (bookingAmount || 0) * (promotion.discountValue / 100);
            // Apply max discount cap if set
            if (promotion.maxDiscountAmount && discountAmount > promotion.maxDiscountAmount) {
                discountAmount = promotion.maxDiscountAmount;
            }
        } else {
            discountAmount = promotion.discountValue;
        }

        res.status(200).json({
            success: true,
            data: {
                isValid: true,
                promotion: {
                    _id: promotion._id,
                    title: promotion.title,
                    code: promotion.code,
                    discount: promotion.discount,
                    discountType: promotion.discountType,
                    discountValue: promotion.discountValue,
                },
                discountAmount: Math.round(discountAmount * 100) / 100,
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
            { new: true }
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
