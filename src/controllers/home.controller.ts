import { Request, Response } from 'express';
import mongoose from 'mongoose';

import Appointment from '../models/appointment.model';
import VendorService from '../models/vendor-service.model';
import SearchLog from '../models/search-log.model';
import Service from '../models/service.model';
import { asyncHandler } from '../utils/asyncHandler.util';

/**
 * Get most booked vendor services based on appointment count.
 * Aggregates confirmed/completed appointments, groups by vendorServiceId,
 * and returns top 10 with vendor details.
 */
export const getMostBookedServices = asyncHandler(async (_req: Request, res: Response) => {
    try {
        // Aggregate appointments to find most booked vendor services
        const mostBooked = await Appointment.aggregate([
            {
                $match: {
                    status: { $in: ['confirmed', 'completed'] }
                }
            },
            {
                $group: {
                    _id: '$vendorServiceId',
                    bookingCount: { $sum: 1 }
                }
            },
            {
                $sort: { bookingCount: -1 }
            },
            {
                $limit: 10
            }
        ]);

        if (mostBooked.length === 0) {
            res.status(200).json({ success: true, data: [] });
            return;
        }

        // Get vendor service IDs
        const vendorServiceIds = mostBooked.map(item => item._id);

        // Fetch vendor services with vendor details
        const vendorServices = await VendorService.find({
            _id: { $in: vendorServiceIds },
            isActive: true
        })
            .select('name image price duration rating totalReviews vendorId')
            .populate('vendorId', 'vendorName')
            .lean();

        // Merge booking count and maintain sort order
        const bookingCountMap = new Map(
            mostBooked.map(item => [item._id.toString(), item.bookingCount])
        );

        const result = vendorServices
            .map((vs: any) => ({
                _id: vs._id,
                name: vs.name,
                image: vs.image,
                price: vs.price,
                duration: vs.duration,
                rating: vs.rating || 0,
                totalReviews: vs.totalReviews || 0,
                vendorName: vs.vendorId?.vendorName || '',
                bookingCount: bookingCountMap.get(vs._id.toString()) || 0,
            }))
            .sort((a: any, b: any) => b.bookingCount - a.bookingCount);

        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
        });
    }
});

/**
 * Get most searched services based on search log aggregation.
 * Groups by serviceId, counts occurrences, returns top 10 with category info.
 */
export const getMostSearchedServices = asyncHandler(async (_req: Request, res: Response) => {
    try {
        const mostSearched = await SearchLog.aggregate([
            {
                $group: {
                    _id: '$serviceId',
                    searchCount: { $sum: 1 }
                }
            },
            {
                $sort: { searchCount: -1 }
            },
            {
                $limit: 10
            }
        ]);

        if (mostSearched.length === 0) {
            res.status(200).json({ success: true, data: [] });
            return;
        }

        const serviceIds = mostSearched.map(item => item._id);

        // Fetch services with category info for icon lookup
        const services = await Service.find({
            _id: { $in: serviceIds },
            isActive: true
        })
            .select('name image categoryId')
            .populate('categoryId', 'name')
            .lean();

        // Merge search count and maintain sort order
        const searchCountMap = new Map(
            mostSearched.map(item => [item._id.toString(), item.searchCount])
        );

        const result = services
            .map((svc: any) => ({
                _id: svc._id,
                name: svc.name,
                image: svc.image,
                categoryName: svc.categoryId?.name || '',
                searchCount: searchCountMap.get(svc._id.toString()) || 0,
            }))
            .sort((a: any, b: any) => b.searchCount - a.searchCount);

        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
        });
    }
});

/**
 * Log a service search selection.
 * Called when a user selects a service from search results.
 */
export const logServiceSearch = asyncHandler(async (req: Request, res: Response) => {
    try {
        const { serviceId, serviceName } = req.body;

        if (!serviceId || !serviceName) {
            res.status(400).json({
                success: false,
                error: 'serviceId and serviceName are required',
            });
            return;
        }

        await SearchLog.create({
            serviceId: new mongoose.Types.ObjectId(serviceId),
            serviceName,
        });

        res.status(201).json({ success: true });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
        });
    }
});
