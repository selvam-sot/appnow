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
        if ('name' in req.body) {
            //req.body.name = new RegExp(`^${req.body.name.toLowerCase()}$`, 'i');
            req.body.name = new RegExp(req.body.name.toLowerCase(), 'i');
        }
        //req.body = {...req.body, ...{ isActive: true }};
        const services = await Service.find(req.body).sort({name: 1});
        console.log("Service req body:", req.body, services.length);
        
        res.status(200).json({
            success: true,
            count: services.length,
            data: services,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
        });
    }
});