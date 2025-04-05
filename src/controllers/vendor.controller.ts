import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import Vendor from '../models/vendor.model';
import { AppError } from '../utils/appError.util';
import { asyncHandler } from '../utils/asyncHandler.util';

export const createVendor = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError('Validation Error', 400);
    }

    const vendor = await Vendor.create(req.body);
    res.status(201).json(vendor);
});

export const getVendors = asyncHandler(async (req: Request, res: Response) => {
    const vendors = await Vendor.find();
    res.json(vendors);
});

export const getVendorById = asyncHandler(async (req: Request, res: Response) => {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
        throw new AppError('Vendor not found', 404);
    }
    res.json(vendor);
});

export const updateVendor = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError('Validation Error', 400);
}

const vendor = await Vendor.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!vendor) {
        throw new AppError('Vendor not found', 404);
    }
    res.json(vendor);
});

export const deleteVendor = asyncHandler(async (req: Request, res: Response) => {
    const vendor = await Vendor.findByIdAndDelete(req.params.id);
    if (!vendor) {
        throw new AppError('Vendor not found', 404);
    }
    res.json({ message: 'Vendor deleted successfully' });
});