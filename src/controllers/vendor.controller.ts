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

/**
 * Get vendors by verification status
 */
export const getVendorsByVerificationStatus = asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.query;

    const query: Record<string, unknown> = {};
    if (status && status !== 'all') {
        query.verificationStatus = status;
    }

    const vendors = await Vendor.find(query)
        .populate('verifiedBy', 'firstName lastName email')
        .sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        data: vendors,
        count: vendors.length
    });
});

/**
 * Verify a vendor (approve or reject)
 */
export const verifyVendor = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, notes } = req.body;
    const adminId = (req as any).user?._id;

    if (!['verified', 'rejected', 'pending'].includes(status)) {
        throw new AppError('Invalid verification status', 400);
    }

    const updateData: Record<string, unknown> = {
        verificationStatus: status,
        verificationNotes: notes || ''
    };

    // Set verified info if approving
    if (status === 'verified') {
        updateData.verifiedAt = new Date();
        updateData.verifiedBy = adminId;
        updateData.isActive = true;
    } else if (status === 'rejected') {
        updateData.verifiedAt = new Date();
        updateData.verifiedBy = adminId;
        updateData.isActive = false;
    }

    const vendor = await Vendor.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
    ).populate('verifiedBy', 'firstName lastName email');

    if (!vendor) {
        throw new AppError('Vendor not found', 404);
    }

    res.status(200).json({
        success: true,
        message: `Vendor ${status === 'verified' ? 'approved' : status === 'rejected' ? 'rejected' : 'set to pending'}`,
        data: vendor
    });
});

/**
 * Get verification stats
 */
export const getVerificationStats = asyncHandler(async (req: Request, res: Response) => {
    const [pending, verified, rejected, total] = await Promise.all([
        Vendor.countDocuments({ verificationStatus: 'pending' }),
        Vendor.countDocuments({ verificationStatus: 'verified' }),
        Vendor.countDocuments({ verificationStatus: 'rejected' }),
        Vendor.countDocuments()
    ]);

    res.status(200).json({
        success: true,
        data: {
            pending,
            verified,
            rejected,
            total
        }
    });
});