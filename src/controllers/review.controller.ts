import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import Review from '../models/review.model';
import Appointment from '../models/appointment.model';
import VendorService from '../models/vendor-service.model';
import Vendor from '../models/vendor.model';
import { AppError } from '../utils/appError.util';
import { asyncHandler } from '../utils/asyncHandler.util';
import logger from '../config/logger';

// Create a review
export const createReview = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError('Validation Error', 400);
    }

    const { appointmentId, rating, title, comment, images } = req.body;

    // Check if appointment exists and is completed
    const appointment = await Appointment.findById(appointmentId)
        .populate('vendorServiceId');

    if (!appointment) {
        return res.status(404).json({
            success: false,
            message: 'Appointment not found'
        });
    }

    // Verify the user owns this appointment
    const customerId = req.body.customerId || (req as any).user?._id;
    if (appointment.customerId.toString() !== customerId?.toString()) {
        return res.status(403).json({
            success: false,
            message: 'You can only review your own appointments'
        });
    }

    // Check if appointment is completed
    if (appointment.status !== 'completed' && appointment.status !== 'confirmed') {
        return res.status(400).json({
            success: false,
            message: 'You can only review completed appointments'
        });
    }

    // Check if already reviewed
    const existingReview = await Review.findOne({ appointmentId });
    if (existingReview) {
        return res.status(400).json({
            success: false,
            message: 'You have already reviewed this appointment'
        });
    }

    // Get vendor service - handle both populated and non-populated cases
    const vendorServiceIdValue = (appointment.vendorServiceId as any)?._id || appointment.vendorServiceId;
    const vendorService = await VendorService.findById(vendorServiceIdValue);
    if (!vendorService) {
        return res.status(404).json({
            success: false,
            message: 'Vendor service not found'
        });
    }

    // Create the review
    const review = await Review.create({
        customerId,
        vendorServiceId: vendorServiceIdValue,
        appointmentId,
        vendorId: vendorService.vendorId,
        rating,
        title,
        comment,
        images,
        status: 'approved', // Auto-approve
        isVerified: true
    });

    // Update vendor average rating
    await updateVendorRating(vendorService.vendorId.toString());

    logger.info(`Review created for appointment ${appointmentId}`);

    res.status(201).json({
        success: true,
        message: 'Review submitted successfully',
        data: review
    });
});

// Get reviews for a vendor service
export const getVendorServiceReviews = asyncHandler(async (req: Request, res: Response) => {
    const { vendorServiceId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const reviews = await Review.find({
        vendorServiceId,
        status: 'approved'
    })
        .populate('customerId', 'firstName lastName avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    const total = await Review.countDocuments({
        vendorServiceId,
        status: 'approved'
    });

    // Calculate rating stats
    const ratingStats = await Review.aggregate([
        { $match: { vendorServiceId: require('mongoose').Types.ObjectId.createFromHexString(vendorServiceId), status: 'approved' } },
        {
            $group: {
                _id: null,
                averageRating: { $avg: '$rating' },
                totalReviews: { $sum: 1 },
                rating5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
                rating4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
                rating3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
                rating2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
                rating1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
            }
        }
    ]);

    res.status(200).json({
        success: true,
        data: reviews,
        stats: ratingStats[0] || {
            averageRating: 0,
            totalReviews: 0,
            rating5: 0,
            rating4: 0,
            rating3: 0,
            rating2: 0,
            rating1: 0
        },
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    });
});

// Get reviews for a vendor
export const getVendorReviews = asyncHandler(async (req: Request, res: Response) => {
    const { vendorId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const reviews = await Review.find({
        vendorId,
        status: 'approved'
    })
        .populate('customerId', 'firstName lastName avatar')
        .populate('vendorServiceId', 'name image')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    const total = await Review.countDocuments({
        vendorId,
        status: 'approved'
    });

    // Calculate rating stats
    const ratingStats = await Review.aggregate([
        { $match: { vendorId: require('mongoose').Types.ObjectId.createFromHexString(vendorId), status: 'approved' } },
        {
            $group: {
                _id: null,
                averageRating: { $avg: '$rating' },
                totalReviews: { $sum: 1 },
                rating5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
                rating4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
                rating3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
                rating2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
                rating1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
            }
        }
    ]);

    res.status(200).json({
        success: true,
        data: reviews,
        stats: ratingStats[0] || {
            averageRating: 0,
            totalReviews: 0,
            rating5: 0,
            rating4: 0,
            rating3: 0,
            rating2: 0,
            rating1: 0
        },
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    });
});

// Get user's reviews
export const getUserReviews = asyncHandler(async (req: Request, res: Response) => {
    const { customerId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const reviews = await Review.find({ customerId })
        .populate('vendorServiceId', 'name image')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    const total = await Review.countDocuments({ customerId });

    res.status(200).json({
        success: true,
        data: reviews,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    });
});

// Update a review
export const updateReview = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { rating, title, comment, images } = req.body;

    const review = await Review.findById(id);
    if (!review) {
        return res.status(404).json({
            success: false,
            message: 'Review not found'
        });
    }

    // Verify ownership
    const customerId = req.body.customerId || (req as any).user?._id;
    if (review.customerId.toString() !== customerId?.toString()) {
        return res.status(403).json({
            success: false,
            message: 'You can only update your own reviews'
        });
    }

    // Update fields
    if (rating) review.rating = rating;
    if (title !== undefined) review.title = title;
    if (comment !== undefined) review.comment = comment;
    if (images) review.images = images;

    const updatedReview = await review.save();

    // Update vendor rating
    await updateVendorRating(review.vendorId.toString());

    res.status(200).json({
        success: true,
        message: 'Review updated successfully',
        data: updatedReview
    });
});

// Delete a review
export const deleteReview = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const review = await Review.findById(id);
    if (!review) {
        return res.status(404).json({
            success: false,
            message: 'Review not found'
        });
    }

    // Verify ownership
    const customerId = req.body.customerId || (req as any).user?._id;
    if (review.customerId.toString() !== customerId?.toString()) {
        return res.status(403).json({
            success: false,
            message: 'You can only delete your own reviews'
        });
    }

    const vendorId = review.vendorId.toString();
    await Review.findByIdAndDelete(id);

    // Update vendor rating
    await updateVendorRating(vendorId);

    res.status(200).json({
        success: true,
        message: 'Review deleted successfully'
    });
});

// Check if user can review an appointment
export const canReviewAppointment = asyncHandler(async (req: Request, res: Response) => {
    const { appointmentId } = req.params;
    const customerId = req.query.customerId || (req as any).user?._id;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
        return res.status(200).json({
            success: true,
            canReview: false,
            reason: 'Appointment not found'
        });
    }

    // Check ownership
    if (appointment.customerId.toString() !== customerId?.toString()) {
        return res.status(200).json({
            success: true,
            canReview: false,
            reason: 'Not your appointment'
        });
    }

    // Check status
    if (appointment.status !== 'completed' && appointment.status !== 'confirmed') {
        return res.status(200).json({
            success: true,
            canReview: false,
            reason: 'Appointment not completed'
        });
    }

    // Check existing review
    const existingReview = await Review.findOne({ appointmentId });
    if (existingReview) {
        return res.status(200).json({
            success: true,
            canReview: false,
            reason: 'Already reviewed',
            existingReview
        });
    }

    return res.status(200).json({
        success: true,
        canReview: true
    });
});

// Helper function to update vendor's average rating
async function updateVendorRating(vendorId: string) {
    try {
        const stats = await Review.aggregate([
            { $match: { vendorId: require('mongoose').Types.ObjectId.createFromHexString(vendorId), status: 'approved' } },
            {
                $group: {
                    _id: null,
                    averageRating: { $avg: '$rating' },
                    totalReviews: { $sum: 1 }
                }
            }
        ]);

        const avgRating = stats[0]?.averageRating || 0;
        const totalReviews = stats[0]?.totalReviews || 0;

        await Vendor.findByIdAndUpdate(vendorId, {
            rating: Math.round(avgRating * 10) / 10, // Round to 1 decimal
            totalReviews
        });

        logger.info(`Updated vendor ${vendorId} rating to ${avgRating}`);
    } catch (error: any) {
        logger.error(`Failed to update vendor rating: ${error.message}`);
    }
}

// Admin: Get all reviews (with moderation)
export const getAllReviews = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const skip = (page - 1) * limit;

    const query: any = {};
    if (status) query.status = status;

    // For vendor users, only show reviews for their services
    if (req.user && req.user.role === 'vendor') {
        const vendor = await Vendor.findOne({ userId: req.user._id });
        if (vendor) {
            query.vendorId = vendor._id;
        }
    }

    const reviews = await Review.find(query)
        .populate('customerId', 'firstName lastName email')
        .populate('vendorServiceId', 'name')
        .populate('vendorId', 'vendorName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    const total = await Review.countDocuments(query);

    res.status(200).json({
        success: true,
        data: reviews,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    });
});

// Admin: Update review status (approve/reject)
export const updateReviewStatus = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'approved', 'rejected'].includes(status)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid status'
        });
    }

    const review = await Review.findByIdAndUpdate(
        id,
        { status },
        { new: true }
    );

    if (!review) {
        return res.status(404).json({
            success: false,
            message: 'Review not found'
        });
    }

    // Update vendor rating if status changed
    await updateVendorRating(review.vendorId.toString());

    res.status(200).json({
        success: true,
        message: `Review ${status}`,
        data: review
    });
});
