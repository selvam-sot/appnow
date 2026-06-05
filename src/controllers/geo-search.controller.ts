import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.util';
import Vendor from '../models/vendor.model';
import VendorService from '../models/vendor-service.model';

/**
 * Near-me geo-search for vendors.
 * GET /api/v1/customer/search/near-me?lat=37.7749&lng=-122.4194&radiusMiles=10&categoryId=...
 */
export const searchVendorsNearMe = asyncHandler(async (req: Request, res: Response) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radiusMiles = Math.min(50, Math.max(1, Number(req.query.radiusMiles) || 10));
  const categoryId = req.query.categoryId as string | undefined;
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({
      success: false,
      message: 'lat and lng are required and must be numeric',
    });
  }

  // MongoDB $geoNear expects meters
  const radiusMeters = radiusMiles * 1609.344;

  // Use aggregation $geoNear so we can read the computed distance per vendor
  const pipeline: any[] = [
    {
      $geoNear: {
        near: { type: 'Point', coordinates: [lng, lat] },
        distanceField: 'distanceMeters',
        maxDistance: radiusMeters,
        spherical: true,
        query: { isActive: true },
      },
    },
    { $limit: limit },
    {
      $addFields: {
        distanceMiles: { $divide: ['$distanceMeters', 1609.344] },
      },
    },
  ];

  const vendors = await Vendor.aggregate(pipeline);

  // If categoryId filter is provided, narrow to vendors that have at least one
  // active service in that category
  let filtered = vendors;
  if (categoryId) {
    const vendorIds = vendors.map((v) => v._id);
    const services = await VendorService.find({
      vendorId: { $in: vendorIds },
      categoryId: new mongoose.Types.ObjectId(categoryId),
      isActive: true,
    }).select('vendorId').lean();
    const matchedVendorIds = new Set(services.map((s) => s.vendorId.toString()));
    filtered = vendors.filter((v) => matchedVendorIds.has(v._id.toString()));
  }

  res.status(200).json({
    success: true,
    count: filtered.length,
    data: filtered.map((v) => ({
      _id: v._id,
      vendorName: v.vendorName,
      image: v.image,
      city: v.city,
      state: v.state,
      rating: v.rating,
      totalReviews: v.totalReviews,
      distanceMiles: Math.round(v.distanceMiles * 10) / 10,
      geoLocation: v.geoLocation,
    })),
  });
});
