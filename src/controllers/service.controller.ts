import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import Service from './../models/service.model';
import Category from './../models/category.model';
import SubCategory from './../models/sub-category.model';
import VendorService from './../models/vendor-service.model';
import { AppError } from '../utils/appError.util';
import { asyncHandler } from '../utils/asyncHandler.util';

export const createService = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError('Validation Error', 400);
    }

    const service = await Service.create(req.body);
    res.status(201).json(service);
});

export const getServices = asyncHandler(async (req: Request, res: Response) => {
    const services = await Service.find().sort({name: 1}).populate('categoryId').populate('subCategoryId');
    res.json(services);
});

export const getServiceById = asyncHandler(async (req: Request, res: Response) => {
    const service = await Service.findById(req.params.id).populate('categoryId').populate('subCategoryId');
    if (!service) {
        throw new AppError('Service not found', 404);
    }
    res.json(service);
});

export const updateService = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError('Validation Error', 400);
    }

    const service = await Service.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!service) {
        throw new AppError('Service not found', 404);
    }
    res.json(service);
});

export const deleteService = asyncHandler(async (req: Request, res: Response) => {
    const service = await Service.findByIdAndDelete(req.params.id);
    if (!service) {
        throw new AppError('Service not found', 404);
    }
    res.json({ message: 'Service deleted successfully' });
});

export const getServiceList = asyncHandler(async (req: Request, res: Response) => {
    try {
        // Whitelist allowed query fields to prevent NoSQL injection
        const allowedFields = ['isActive', 'categoryId', 'subCategoryId'];
        const baseFilter: Record<string, any> = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                baseFilter[field] = req.body[field];
            }
        }

        const limit = (req.body.limit && Number.isInteger(Number(req.body.limit)))
            ? Math.min(Number(req.body.limit), 100)
            : 100;

        // If no search term, just return services with base filters
        if (!req.body.name || typeof req.body.name !== 'string') {
            const services = await Service.find(baseFilter).sort({ name: 1 }).limit(limit);
            res.status(200).json({ success: true, count: services.length, data: services });
            return;
        }

        const escaped = req.body.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const nameRegex = new RegExp(escaped, 'i');

        // Search across Service name, Category name, SubCategory name, and VendorService name in parallel
        const [matchingCategories, matchingSubCategories, matchingVendorServices] = await Promise.all([
            Category.find({ name: nameRegex }).select('_id').lean(),
            SubCategory.find({ name: nameRegex }).select('_id').lean(),
            VendorService.find({ name: nameRegex }).select('serviceId').lean(),
        ]);

        const categoryIds = matchingCategories.map(c => c._id);
        const subCategoryIds = matchingSubCategories.map(sc => sc._id);
        const serviceIdsFromVS = [...new Set(matchingVendorServices.map(vs => (vs as any).serviceId.toString()))];

        // Build OR conditions: match service name, or parent category/subcategory, or linked vendor service
        const orConditions: any[] = [
            { name: nameRegex },
        ];
        if (categoryIds.length > 0) {
            orConditions.push({ categoryId: { $in: categoryIds } });
        }
        if (subCategoryIds.length > 0) {
            orConditions.push({ subCategoryId: { $in: subCategoryIds } });
        }
        if (serviceIdsFromVS.length > 0) {
            orConditions.push({ _id: { $in: serviceIdsFromVS } });
        }

        const filter = { ...baseFilter, $or: orConditions };
        const services = await Service.find(filter).sort({ name: 1 }).limit(limit);

        res.status(200).json({
            success: true,
            count: services.length,
            data: services,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error',
        });
    }
});