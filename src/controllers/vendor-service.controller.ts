import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import VendorService from './../models/vendor-service.model';
import { AppError } from '../utils/appError.util';
import { asyncHandler } from '../utils/asyncHandler.util';

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