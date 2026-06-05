import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.util';
import { AppError } from '../utils/appError.util';
import User from '../models/user.model';

/**
 * Customer address book — saved service addresses for faster booking.
 * All routes assume `protect` middleware has set `req.user`.
 */

/** GET /api/v1/customer/addresses */
export const listAddresses = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError('Not authenticated', 401);

  const dbUser = await User.findById(user._id).select('addresses').lean();
  res.status(200).json({
    success: true,
    data: (dbUser as any)?.addresses || [],
  });
});

/** POST /api/v1/customer/addresses */
export const createAddress = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError('Not authenticated', 401);

  const { label, address1, address2, city, state, zip, country, location, isDefault } = req.body;

  if (!address1 || !city || !state || !zip) {
    throw new AppError('address1, city, state, and zip are required', 400);
  }

  const dbUser = await User.findById(user._id);
  if (!dbUser) throw new AppError('User not found', 404);

  const addresses: any[] = (dbUser as any).addresses || [];

  // If incoming is default, unset any existing default
  if (isDefault) {
    addresses.forEach((a) => (a.isDefault = false));
  }

  // If this is the first address, force default
  const shouldBeDefault = addresses.length === 0 || isDefault;

  const newAddress: any = {
    label: label || 'Home',
    address1,
    address2,
    city,
    state,
    zip,
    country: country || 'US',
    isDefault: shouldBeDefault,
    createdAt: new Date(),
  };
  if (location && Array.isArray(location.coordinates) && location.coordinates.length === 2) {
    newAddress.location = { type: 'Point', coordinates: location.coordinates };
  }

  addresses.push(newAddress);
  (dbUser as any).addresses = addresses;
  await dbUser.save();

  res.status(201).json({
    success: true,
    data: (dbUser as any).addresses,
  });
});

/** PUT /api/v1/customer/addresses/:addressId */
export const updateAddress = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError('Not authenticated', 401);
  const { addressId } = req.params;

  const dbUser = await User.findById(user._id);
  if (!dbUser) throw new AppError('User not found', 404);

  const addresses: any[] = (dbUser as any).addresses || [];
  const target = addresses.find((a) => a._id?.toString() === addressId);
  if (!target) throw new AppError('Address not found', 404);

  const allowed = ['label', 'address1', 'address2', 'city', 'state', 'zip', 'country', 'location'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) target[key] = req.body[key];
  }
  if (req.body.isDefault === true) {
    addresses.forEach((a) => (a.isDefault = false));
    target.isDefault = true;
  }
  if (req.body.location && Array.isArray(req.body.location.coordinates)) {
    target.location = { type: 'Point', coordinates: req.body.location.coordinates };
  }

  await dbUser.save();
  res.status(200).json({ success: true, data: addresses });
});

/** DELETE /api/v1/customer/addresses/:addressId */
export const deleteAddress = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError('Not authenticated', 401);
  const { addressId } = req.params;

  const dbUser = await User.findById(user._id);
  if (!dbUser) throw new AppError('User not found', 404);

  const addresses: any[] = (dbUser as any).addresses || [];
  const wasDefault = addresses.find((a) => a._id?.toString() === addressId)?.isDefault;
  const filtered = addresses.filter((a) => a._id?.toString() !== addressId);

  // If we deleted the default and others remain, promote the first one
  if (wasDefault && filtered.length > 0) {
    filtered[0].isDefault = true;
  }

  (dbUser as any).addresses = filtered;
  await dbUser.save();

  res.status(200).json({ success: true, data: filtered });
});

/** PATCH /api/v1/customer/addresses/:addressId/default */
export const setDefaultAddress = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError('Not authenticated', 401);
  const { addressId } = req.params;

  const dbUser = await User.findById(user._id);
  if (!dbUser) throw new AppError('User not found', 404);

  const addresses: any[] = (dbUser as any).addresses || [];
  const target = addresses.find((a) => a._id?.toString() === addressId);
  if (!target) throw new AppError('Address not found', 404);

  addresses.forEach((a) => (a.isDefault = false));
  target.isDefault = true;
  await dbUser.save();

  res.status(200).json({ success: true, data: addresses });
});

/** PUT /api/v1/customer/notification-prefs */
export const updateNotificationPrefs = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError('Not authenticated', 401);

  const dbUser = await User.findById(user._id);
  if (!dbUser) throw new AppError('User not found', 404);

  const allowed = [
    'pushBookingUpdates',
    'pushReminders',
    'pushPromotions',
    'emailBookingUpdates',
    'emailReminders',
    'emailPromotions',
    'smsBookingUpdates',
    'smsReminders',
    'smsPromotions',
  ];

  const current = (dbUser as any).notificationPrefs || {};
  for (const key of allowed) {
    if (typeof req.body[key] === 'boolean') {
      current[key] = req.body[key];
    }
  }
  (dbUser as any).notificationPrefs = current;
  await dbUser.save();

  res.status(200).json({ success: true, data: current });
});

/** GET /api/v1/customer/notification-prefs */
export const getNotificationPrefs = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError('Not authenticated', 401);

  const dbUser = await User.findById(user._id).select('notificationPrefs smsConsent marketingEmailConsent').lean();
  res.status(200).json({
    success: true,
    data: {
      ...((dbUser as any)?.notificationPrefs || {}),
      smsConsent: (dbUser as any)?.smsConsent || false,
      marketingEmailConsent: (dbUser as any)?.marketingEmailConsent || false,
    },
  });
});
