import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import VendorService from './../models/vendor-service.model';
import Vendor from './../models/vendor.model';
import Review from './../models/review.model';
import { AppError } from '../utils/appError.util';
import { asyncHandler } from '../utils/asyncHandler.util';
import mongoose from 'mongoose';

export const createVendorService = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError('Validation Error', 400);
    }

    const vendorService = await VendorService.create(req.body);
    res.status(201).json(vendorService);
});

export const getVendorServices = asyncHandler(async (req: Request, res: Response) => {
    const vendorServices = await VendorService.find().sort({name: 1}).populate('categoryId').populate('subCategoryId').populate('vendorId').populate('serviceId');
    res.json(vendorServices);
});

export const getVendorServiceById = asyncHandler(async (req: Request, res: Response) => {
    const vendorService = await VendorService.findById(req.params.id).populate('vendorId').populate('serviceId');
    if (!vendorService) {
        throw new AppError('Vendor Service not found', 404);
    }
    res.json(vendorService);
});

export const updateVendorService = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError('Validation Error', 400);
}

const vendorService = await VendorService.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!vendorService) {
        throw new AppError('Vendor Service not found', 404);
    }
    res.json(vendorService);
});

export const deleteVendorService = asyncHandler(async (req: Request, res: Response) => {
    const vendorService = await VendorService.findByIdAndDelete(req.params.id);
    if (!vendorService) {
        throw new AppError('Vendor Service not found', 404);
    }
    res.json({ message: 'Vendor Service deleted successfully' });
});

export const getVendorServiceList = asyncHandler(async (req: Request, res: Response) => {
    try {
        if ('_ids' in req.body) {
            req.body = { '_id': { $in: req.body._ids } };
        } else {
            req.body = {...req.body, ...{ isActive: true }};
        }
        const filter: Record<string, any> = {...req.body, isActive: true};
        console.log(filter);
        const vendorServices = await VendorService.find(filter).sort({name: 1}).populate('categoryId').populate('subCategoryId').populate('vendorId').populate('serviceId');

        res.status(200).json({
            success: true,
            count: vendorServices.length,
            data: vendorServices,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
        });
    }
});

/**
 * Advanced search endpoint for vendor services
 * Supports: text search, filters, sorting, pagination
 */
export const searchVendorServices = asyncHandler(async (req: Request, res: Response) => {
    const {
        // Search
        q,           // Text search query
        // Filters
        categoryId,
        subCategoryId,
        serviceId,
        vendorId,
        minPrice,
        maxPrice,
        minRating,
        maxRating,
        minDuration,
        maxDuration,
        servicePlace, // 'vendor', 'customer', 'both'
        serviceType,  // 'In Person', 'Online', etc.
        city,
        state,
        country,
        tags,         // Array of tags
        // Sorting
        sortBy,       // 'price', 'rating', 'duration', 'name', 'createdAt'
        sortOrder,    // 'asc' or 'desc'
        // Pagination
        page = 1,
        limit = 20,
    } = req.query;

    // Build filter object
    const filter: Record<string, any> = { isActive: true };

    // Text search using MongoDB text index
    if (q && typeof q === 'string' && q.trim()) {
        filter.$text = { $search: q.trim() };
    }

    // Category filters
    if (categoryId) {
        filter.categoryId = new mongoose.Types.ObjectId(categoryId as string);
    }
    if (subCategoryId) {
        filter.subCategoryId = new mongoose.Types.ObjectId(subCategoryId as string);
    }
    if (serviceId) {
        filter.serviceId = new mongoose.Types.ObjectId(serviceId as string);
    }
    if (vendorId) {
        filter.vendorId = new mongoose.Types.ObjectId(vendorId as string);
    }

    // Price range filter
    if (minPrice || maxPrice) {
        filter.price = {};
        if (minPrice) filter.price.$gte = Number(minPrice);
        if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    // Duration range filter
    if (minDuration || maxDuration) {
        filter.duration = {};
        if (minDuration) filter.duration.$gte = Number(minDuration);
        if (maxDuration) filter.duration.$lte = Number(maxDuration);
    }

    // Service place filter
    if (servicePlace) {
        filter.servicePlace = servicePlace;
    }

    // Service type filter
    if (serviceType) {
        filter.serviceType = serviceType;
    }

    // Tags filter
    if (tags) {
        const tagArray = Array.isArray(tags) ? tags : (tags as string).split(',');
        filter.tags = { $in: tagArray };
    }

    // Location filter - need to get vendor IDs first
    let vendorIdsFromLocation: mongoose.Types.ObjectId[] | null = null;
    if (city || state || country) {
        const vendorFilter: Record<string, any> = { isActive: true };
        if (city) vendorFilter.city = { $regex: city, $options: 'i' };
        if (state) vendorFilter.state = { $regex: state, $options: 'i' };
        if (country) vendorFilter.country = { $regex: country, $options: 'i' };

        const vendors = await Vendor.find(vendorFilter).select('_id');
        vendorIdsFromLocation = vendors.map(v => v._id);

        if (vendorIdsFromLocation.length === 0) {
            // No vendors in location, return empty result
            return res.status(200).json({
                success: true,
                data: [],
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total: 0,
                    totalPages: 0,
                },
            });
        }

        if (filter.vendorId) {
            // If vendorId is already specified, intersect with location results
            filter.vendorId = {
                $in: vendorIdsFromLocation.filter(id =>
                    id.toString() === filter.vendorId.toString()
                )
            };
        } else {
            filter.vendorId = { $in: vendorIdsFromLocation };
        }
    }

    // Build sort object
    let sort: Record<string, 1 | -1> = { createdAt: -1 }; // Default sort
    if (sortBy) {
        const order = sortOrder === 'asc' ? 1 : -1;
        switch (sortBy) {
            case 'price':
                sort = { price: order };
                break;
            case 'duration':
                sort = { duration: order };
                break;
            case 'name':
                sort = { name: order };
                break;
            case 'createdAt':
                sort = { createdAt: order };
                break;
            case 'rating':
                // Rating sort will be handled after aggregation
                break;
            default:
                sort = { createdAt: -1 };
        }
    }

    // Add text score to sort if text search is used
    if (filter.$text) {
        sort = { score: { $meta: 'textScore' } as any, ...sort };
    }

    // Pagination
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Execute query
    let query = VendorService.find(filter);

    // Add text score projection if text search
    if (filter.$text) {
        query = query.select({ score: { $meta: 'textScore' } });
    }

    // Get total count for pagination
    const total = await VendorService.countDocuments(filter);

    // Get results with pagination
    let vendorServices = await query
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .populate('categoryId', 'name image')
        .populate('subCategoryId', 'name')
        .populate('vendorId', 'vendorName city state rating image')
        .populate('serviceId', 'name')
        .lean();

    // If rating filter or sort is requested, calculate ratings
    if (minRating || maxRating || sortBy === 'rating') {
        // Get ratings for all vendor services
        const serviceIds = vendorServices.map(vs => vs._id);
        const ratings = await Review.aggregate([
            {
                $match: {
                    vendorServiceId: { $in: serviceIds },
                    status: 'approved'
                }
            },
            {
                $group: {
                    _id: '$vendorServiceId',
                    avgRating: { $avg: '$rating' },
                    reviewCount: { $sum: 1 }
                }
            }
        ]);

        const ratingMap = new Map(ratings.map(r => [r._id.toString(), r]));

        // Add ratings to vendor services
        vendorServices = vendorServices.map(vs => ({
            ...vs,
            avgRating: ratingMap.get(vs._id.toString())?.avgRating || 0,
            reviewCount: ratingMap.get(vs._id.toString())?.reviewCount || 0,
        }));

        // Filter by rating if specified
        if (minRating || maxRating) {
            vendorServices = vendorServices.filter(vs => {
                const rating = (vs as any).avgRating || 0;
                if (minRating && rating < Number(minRating)) return false;
                if (maxRating && rating > Number(maxRating)) return false;
                return true;
            });
        }

        // Sort by rating if specified
        if (sortBy === 'rating') {
            const order = sortOrder === 'asc' ? 1 : -1;
            vendorServices.sort((a, b) => {
                const ratingA = (a as any).avgRating || 0;
                const ratingB = (b as any).avgRating || 0;
                return (ratingA - ratingB) * order;
            });
        }
    }

    res.status(200).json({
        success: true,
        data: vendorServices,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
        },
    });
});