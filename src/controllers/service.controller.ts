import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import Service from './../models/service.model';
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
        const filter: Record<string, any> = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                filter[field] = req.body[field];
            }
        }

        // Safely handle name search with escaped RegExp to prevent ReDoS
        if (req.body.name && typeof req.body.name === 'string') {
            const escaped = req.body.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.name = new RegExp(escaped, 'i');
        }

        // Apply limit if provided
        let query = Service.find(filter).sort({ name: 1 });
        if (req.body.limit && Number.isInteger(Number(req.body.limit))) {
            query = query.limit(Math.min(Number(req.body.limit), 100));
        }

        const services = await query;

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