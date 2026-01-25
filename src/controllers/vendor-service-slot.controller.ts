import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import VendorServiceSlot from '../models/vendor-service-slot.model';
import VendorService from '../models/vendor-service.model';
import Vendor from '../models/vendor.model';
import { AppError } from '../utils/appError.util';
import { asyncHandler } from '../utils/asyncHandler.util';

export const createVendorServiceSlot = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError('Validation Error', 400);
    }

    const vendorServiceSlot = await VendorServiceSlot.create(req.body);
    res.status(201).json(vendorServiceSlot);
});

export const getVendorServiceSlots = asyncHandler(async (req: Request, res: Response) => {
    // Build filter - for vendor users, only show slots for their own services
    const filter: Record<string, any> = {};

    if (req.user && req.user.role === 'vendor') {
        // Find the vendor associated with this user
        const vendor = await Vendor.findOne({ userId: req.user._id });
        if (vendor) {
            // Get all vendor services for this vendor
            const vendorServices = await VendorService.find({ vendorId: vendor._id }).select('_id');
            const serviceIds = vendorServices.map(vs => vs._id);
            filter.vendorServiceId = { $in: serviceIds };
        }
    }

    const vendorServiceSlots = await VendorServiceSlot.find(filter)
        .populate('vendorServiceId')
        .sort({ _id: -1 }); // Sort by _id descending (newest first)
    res.json(vendorServiceSlots);
});

export const getVendorServiceSlotById = asyncHandler(async (req: Request, res: Response) => {
    const vendorServiceSlot = await VendorServiceSlot.findById(req.params.id).populate('vendorServiceId');
    if (!vendorServiceSlot) {
        throw new AppError('Vendor Service Slot not found', 404);
    }
    res.json(vendorServiceSlot);
});

export const updateVendorServiceSlot = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError('Validation Error', 400);
}

const vendorServiceSlot = await VendorServiceSlot.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!vendorServiceSlot) {
        throw new AppError('Vendor Service Slot not found', 404);
    }
    res.json(vendorServiceSlot);
});

export const deleteVendorServiceSlot = asyncHandler(async (req: Request, res: Response) => {
    const vendorServiceSlot = await VendorServiceSlot.findByIdAndDelete(req.params.id);
    if (!vendorServiceSlot) {
        throw new AppError('Vendor Service not found', 404);
    }
    res.json({ message: 'Vendor Service slot deleted successfully' });
});