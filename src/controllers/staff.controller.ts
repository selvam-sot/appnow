import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.util';
import { AppError } from '../utils/appError.util';
import Staff from '../models/staff.model';
import VendorService from '../models/vendor-service.model';
import Appointment from '../models/appointment.model';

/**
 * Staff management endpoints.
 *
 *   Vendor:
 *     GET    /vendor/staff                — list own staff
 *     POST   /vendor/staff                — create staff
 *     PUT    /vendor/staff/:id            — update staff
 *     DELETE /vendor/staff/:id            — soft-delete (isActive = false) if any appointments exist
 *     PATCH  /vendor/staff/:id/toggle     — toggle isActive
 *
 *   Customer:
 *     GET /customer/vendor-services/:id/staff — active staff who can deliver this service
 */

/** GET /vendor/staff */
export const listVendorStaff = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = (req as any).vendorId;
  if (!vendorId) throw new AppError('Vendor session required', 401);

  const staff = await Staff.find({ vendorId })
    .sort({ isActive: -1, name: 1 })
    .lean();

  res.status(200).json({ success: true, data: staff });
});

/** POST /vendor/staff */
export const createVendorStaff = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = (req as any).vendorId;
  if (!vendorId) throw new AppError('Vendor session required', 401);

  const { name, photo, bio, specializations, serviceIds, workingHours } = req.body;
  if (!name || name.trim().length < 2) {
    throw new AppError('Name is required', 400);
  }

  // Verify any serviceIds actually belong to this vendor
  if (Array.isArray(serviceIds) && serviceIds.length > 0) {
    const owned = await VendorService.find({
      _id: { $in: serviceIds },
      vendorId,
    }).select('_id');
    if (owned.length !== serviceIds.length) {
      throw new AppError('One or more services do not belong to this vendor', 400);
    }
  }

  const staff = await Staff.create({
    vendorId,
    name: name.trim(),
    photo,
    bio,
    specializations,
    serviceIds,
    workingHours,
  });

  res.status(201).json({ success: true, data: staff });
});

/** PUT /vendor/staff/:id */
export const updateVendorStaff = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = (req as any).vendorId;
  if (!vendorId) throw new AppError('Vendor session required', 401);
  const { id } = req.params;

  const staff = await Staff.findOne({ _id: id, vendorId });
  if (!staff) throw new AppError('Staff not found', 404);

  const allowed = [
    'name',
    'photo',
    'bio',
    'specializations',
    'serviceIds',
    'workingHours',
    'isActive',
  ];

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      if (key === 'serviceIds' && Array.isArray(req.body.serviceIds)) {
        const owned = await VendorService.find({
          _id: { $in: req.body.serviceIds },
          vendorId,
        }).select('_id');
        if (owned.length !== req.body.serviceIds.length) {
          throw new AppError('One or more services do not belong to this vendor', 400);
        }
      }
      (staff as any)[key] = req.body[key];
    }
  }

  await staff.save();
  res.status(200).json({ success: true, data: staff });
});

/**
 * DELETE /vendor/staff/:id
 * If the staff has any past appointments we soft-delete (isActive = false)
 * so historical records stay intact. If no appointments, hard-delete.
 */
export const deleteVendorStaff = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = (req as any).vendorId;
  if (!vendorId) throw new AppError('Vendor session required', 401);
  const { id } = req.params;

  const staff = await Staff.findOne({ _id: id, vendorId });
  if (!staff) throw new AppError('Staff not found', 404);

  const apptCount = await Appointment.countDocuments({ staffId: id });
  if (apptCount > 0) {
    staff.isActive = false;
    await staff.save();
    res.status(200).json({
      success: true,
      data: staff,
      message: `Staff has ${apptCount} past appointments — deactivated instead of deleted`,
    });
    return;
  }

  await Staff.deleteOne({ _id: id });
  res.status(200).json({ success: true, message: 'Staff removed' });
});

/** PATCH /vendor/staff/:id/toggle */
export const toggleVendorStaff = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = (req as any).vendorId;
  if (!vendorId) throw new AppError('Vendor session required', 401);
  const { id } = req.params;

  const staff = await Staff.findOne({ _id: id, vendorId });
  if (!staff) throw new AppError('Staff not found', 404);

  staff.isActive = !staff.isActive;
  await staff.save();
  res.status(200).json({ success: true, data: staff });
});

/**
 * GET /customer/vendor-services/:id/staff
 * Customer endpoint — returns active staff who can deliver the given
 * vendor service (empty serviceIds = universal). Public so the client
 * can populate the picker before the customer signs in.
 */
export const listStaffForVendorService = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const vendorService = await VendorService.findById(id).select('vendorId').lean();
    if (!vendorService) throw new AppError('Vendor service not found', 404);

    const staff = await Staff.find({
      vendorId: vendorService.vendorId,
      isActive: true,
      $or: [
        { serviceIds: { $size: 0 } },
        { serviceIds: { $exists: false } },
        { serviceIds: new mongoose.Types.ObjectId(id) },
      ],
    })
      .select('name photo bio specializations rating reviewCount totalCompletedAppointments')
      .sort({ rating: -1, name: 1 })
      .lean();

    res.status(200).json({ success: true, data: staff });
  },
);
