import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.util';
import Appointment from '../models/appointment.model';
import User from '../models/user.model';
import VendorService from '../models/vendor-service.model';
import Vendor from '../models/vendor.model';
import mongoose from 'mongoose';

/**
 * Get revenue analytics
 * Includes total revenue, revenue by period, revenue by vendor, payment status breakdown
 */
export const getRevenueAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate, groupBy = 'day' } = req.query;

    // Default to last 30 days if no date range provided
    const end = endDate ? new Date(endDate as string) : new Date();
    end.setHours(23, 59, 59, 999);

    const start = startDate ? new Date(startDate as string) : new Date(end);
    if (!startDate) {
        start.setDate(start.getDate() - 30);
    }
    start.setHours(0, 0, 0, 0);

    // Get date grouping format based on groupBy parameter
    const getDateGroup = () => {
        switch (groupBy) {
            case 'week':
                return {
                    year: { $year: '$createdAt' },
                    week: { $week: '$createdAt' }
                };
            case 'month':
                return {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' }
                };
            default: // day
                return {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                    day: { $dayOfMonth: '$createdAt' }
                };
        }
    };

    // Revenue over time
    const revenueByPeriod = await Appointment.aggregate([
        {
            $match: {
                createdAt: { $gte: start, $lte: end },
                paymentStatus: 'completed'
            }
        },
        {
            $group: {
                _id: getDateGroup(),
                totalRevenue: { $sum: { $ifNull: ['$total', '$serviceFee'] } },
                appointmentCount: { $sum: 1 },
                avgOrderValue: { $avg: { $ifNull: ['$total', '$serviceFee'] } }
            }
        },
        {
            $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 }
        }
    ]);

    // Total revenue summary
    const revenueSummary = await Appointment.aggregate([
        {
            $match: {
                createdAt: { $gte: start, $lte: end }
            }
        },
        {
            $group: {
                _id: null,
                totalRevenue: {
                    $sum: {
                        $cond: [
                            { $eq: ['$paymentStatus', 'completed'] },
                            { $ifNull: ['$total', '$serviceFee'] },
                            0
                        ]
                    }
                },
                totalRefunded: {
                    $sum: {
                        $cond: [
                            { $in: ['$paymentStatus', ['refunded', 'partially_refunded']] },
                            { $ifNull: ['$refundAmount', 0] },
                            0
                        ]
                    }
                },
                pendingRevenue: {
                    $sum: {
                        $cond: [
                            { $eq: ['$paymentStatus', 'pending'] },
                            { $ifNull: ['$total', '$serviceFee'] },
                            0
                        ]
                    }
                },
                totalAppointments: { $sum: 1 },
                completedPayments: {
                    $sum: { $cond: [{ $eq: ['$paymentStatus', 'completed'] }, 1, 0] }
                }
            }
        }
    ]);

    // Revenue by vendor (top 10)
    const revenueByVendor = await Appointment.aggregate([
        {
            $match: {
                createdAt: { $gte: start, $lte: end },
                paymentStatus: 'completed'
            }
        },
        {
            $lookup: {
                from: 'vendorservices',
                localField: 'vendorServiceId',
                foreignField: '_id',
                as: 'vendorService'
            }
        },
        { $unwind: { path: '$vendorService', preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: 'vendors',
                localField: 'vendorService.vendorId',
                foreignField: '_id',
                as: 'vendor'
            }
        },
        { $unwind: { path: '$vendor', preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: '$vendor._id',
                vendorName: { $first: '$vendor.vendorName' },
                totalRevenue: { $sum: { $ifNull: ['$total', '$serviceFee'] } },
                appointmentCount: { $sum: 1 }
            }
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: 10 }
    ]);

    // Payment status breakdown
    const paymentStatusBreakdown = await Appointment.aggregate([
        {
            $match: {
                createdAt: { $gte: start, $lte: end }
            }
        },
        {
            $group: {
                _id: '$paymentStatus',
                count: { $sum: 1 },
                amount: { $sum: { $ifNull: ['$total', '$serviceFee'] } }
            }
        }
    ]);

    // Format revenue by period
    const formattedRevenueByPeriod = revenueByPeriod.map(item => {
        let dateLabel = '';
        if (groupBy === 'week') {
            dateLabel = `${item._id.year}-W${String(item._id.week).padStart(2, '0')}`;
        } else if (groupBy === 'month') {
            dateLabel = `${item._id.year}-${String(item._id.month).padStart(2, '0')}`;
        } else {
            dateLabel = `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`;
        }
        return {
            date: dateLabel,
            totalRevenue: item.totalRevenue,
            appointmentCount: item.appointmentCount,
            avgOrderValue: Math.round(item.avgOrderValue * 100) / 100
        };
    });

    res.status(200).json({
        success: true,
        data: {
            dateRange: { start, end },
            summary: revenueSummary[0] || {
                totalRevenue: 0,
                totalRefunded: 0,
                pendingRevenue: 0,
                totalAppointments: 0,
                completedPayments: 0
            },
            revenueByPeriod: formattedRevenueByPeriod,
            revenueByVendor,
            paymentStatusBreakdown: paymentStatusBreakdown.map(item => ({
                status: item._id || 'unknown',
                count: item.count,
                amount: item.amount
            }))
        }
    });
});

/**
 * Get user analytics
 * Includes user growth, active users, user retention, user demographics
 */
export const getUserAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate, groupBy = 'day' } = req.query;

    // Default to last 30 days if no date range provided
    const end = endDate ? new Date(endDate as string) : new Date();
    end.setHours(23, 59, 59, 999);

    const start = startDate ? new Date(startDate as string) : new Date(end);
    if (!startDate) {
        start.setDate(start.getDate() - 30);
    }
    start.setHours(0, 0, 0, 0);

    // Get date grouping format
    const getDateGroup = () => {
        switch (groupBy) {
            case 'week':
                return {
                    year: { $year: '$createdAt' },
                    week: { $week: '$createdAt' }
                };
            case 'month':
                return {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' }
                };
            default:
                return {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                    day: { $dayOfMonth: '$createdAt' }
                };
        }
    };

    // New users over time
    const userGrowth = await User.aggregate([
        {
            $match: {
                createdAt: { $gte: start, $lte: end }
            }
        },
        {
            $group: {
                _id: getDateGroup(),
                newUsers: { $sum: 1 }
            }
        },
        {
            $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 }
        }
    ]);

    // Total user summary
    const userSummary = await User.aggregate([
        {
            $facet: {
                total: [{ $count: 'count' }],
                newInPeriod: [
                    { $match: { createdAt: { $gte: start, $lte: end } } },
                    { $count: 'count' }
                ],
                withAppointments: [
                    {
                        $lookup: {
                            from: 'appointments',
                            localField: '_id',
                            foreignField: 'customerId',
                            as: 'appointments'
                        }
                    },
                    { $match: { 'appointments.0': { $exists: true } } },
                    { $count: 'count' }
                ]
            }
        }
    ]);

    // Active users (users who made appointments in the period)
    const activeUsers = await Appointment.aggregate([
        {
            $match: {
                createdAt: { $gte: start, $lte: end }
            }
        },
        {
            $group: {
                _id: '$customerId'
            }
        },
        {
            $count: 'activeUsers'
        }
    ]);

    // Top users by appointments
    const topUsers = await Appointment.aggregate([
        {
            $match: {
                createdAt: { $gte: start, $lte: end }
            }
        },
        {
            $group: {
                _id: '$customerId',
                appointmentCount: { $sum: 1 },
                totalSpent: { $sum: { $ifNull: ['$total', '$serviceFee'] } }
            }
        },
        { $sort: { appointmentCount: -1 } },
        { $limit: 10 },
        {
            $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: '_id',
                as: 'user'
            }
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        {
            $project: {
                _id: 1,
                firstName: '$user.firstName',
                lastName: '$user.lastName',
                email: '$user.email',
                appointmentCount: 1,
                totalSpent: 1
            }
        }
    ]);

    // User retention (users who made more than one appointment)
    const retentionData = await Appointment.aggregate([
        {
            $group: {
                _id: '$customerId',
                appointmentCount: { $sum: 1 }
            }
        },
        {
            $group: {
                _id: null,
                oneTime: { $sum: { $cond: [{ $eq: ['$appointmentCount', 1] }, 1, 0] } },
                returning: { $sum: { $cond: [{ $gt: ['$appointmentCount', 1] }, 1, 0] } },
                total: { $sum: 1 }
            }
        }
    ]);

    // Format user growth
    const formattedUserGrowth = userGrowth.map(item => {
        let dateLabel = '';
        if (groupBy === 'week') {
            dateLabel = `${item._id.year}-W${String(item._id.week).padStart(2, '0')}`;
        } else if (groupBy === 'month') {
            dateLabel = `${item._id.year}-${String(item._id.month).padStart(2, '0')}`;
        } else {
            dateLabel = `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`;
        }
        return {
            date: dateLabel,
            newUsers: item.newUsers
        };
    });

    const summaryData = userSummary[0];
    res.status(200).json({
        success: true,
        data: {
            dateRange: { start, end },
            summary: {
                totalUsers: summaryData?.total[0]?.count || 0,
                newUsersInPeriod: summaryData?.newInPeriod[0]?.count || 0,
                usersWithAppointments: summaryData?.withAppointments[0]?.count || 0,
                activeUsersInPeriod: activeUsers[0]?.activeUsers || 0
            },
            userGrowth: formattedUserGrowth,
            topUsers,
            retention: retentionData[0] ? {
                oneTimeUsers: retentionData[0].oneTime,
                returningUsers: retentionData[0].returning,
                retentionRate: retentionData[0].total > 0
                    ? Math.round((retentionData[0].returning / retentionData[0].total) * 100)
                    : 0
            } : { oneTimeUsers: 0, returningUsers: 0, retentionRate: 0 }
        }
    });
});

/**
 * Get appointment analytics
 * Includes appointment trends, status distribution, popular services, peak times
 */
export const getAppointmentAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate, groupBy = 'day' } = req.query;

    // Default to last 30 days if no date range provided
    const end = endDate ? new Date(endDate as string) : new Date();
    end.setHours(23, 59, 59, 999);

    const start = startDate ? new Date(startDate as string) : new Date(end);
    if (!startDate) {
        start.setDate(start.getDate() - 30);
    }
    start.setHours(0, 0, 0, 0);

    // Get date grouping format
    const getDateGroup = () => {
        switch (groupBy) {
            case 'week':
                return {
                    year: { $year: '$createdAt' },
                    week: { $week: '$createdAt' }
                };
            case 'month':
                return {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' }
                };
            default:
                return {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                    day: { $dayOfMonth: '$createdAt' }
                };
        }
    };

    // Appointments over time
    const appointmentTrends = await Appointment.aggregate([
        {
            $match: {
                createdAt: { $gte: start, $lte: end }
            }
        },
        {
            $group: {
                _id: getDateGroup(),
                count: { $sum: 1 },
                completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } }
            }
        },
        {
            $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 }
        }
    ]);

    // Appointment summary
    const appointmentSummary = await Appointment.aggregate([
        {
            $match: {
                createdAt: { $gte: start, $lte: end }
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
                confirmed: { $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] } },
                completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
                avgValue: { $avg: { $ifNull: ['$total', '$serviceFee'] } }
            }
        }
    ]);

    // Status distribution
    const statusDistribution = await Appointment.aggregate([
        {
            $match: {
                createdAt: { $gte: start, $lte: end }
            }
        },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);

    // Top services by appointments
    const topServices = await Appointment.aggregate([
        {
            $match: {
                createdAt: { $gte: start, $lte: end }
            }
        },
        {
            $lookup: {
                from: 'vendorservices',
                localField: 'vendorServiceId',
                foreignField: '_id',
                as: 'vendorService'
            }
        },
        { $unwind: { path: '$vendorService', preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: 'services',
                localField: 'vendorService.serviceId',
                foreignField: '_id',
                as: 'service'
            }
        },
        { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: '$service._id',
                serviceName: { $first: '$service.name' },
                count: { $sum: 1 },
                revenue: { $sum: { $ifNull: ['$total', '$serviceFee'] } }
            }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
    ]);

    // Peak booking times (by hour)
    const peakTimes = await Appointment.aggregate([
        {
            $match: {
                createdAt: { $gte: start, $lte: end }
            }
        },
        {
            $addFields: {
                hour: {
                    $toInt: { $substr: ['$startTime', 0, 2] }
                }
            }
        },
        {
            $group: {
                _id: '$hour',
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    // Peak booking days (by day of week)
    const peakDays = await Appointment.aggregate([
        {
            $match: {
                appointmentDate: { $gte: start, $lte: end }
            }
        },
        {
            $group: {
                _id: { $dayOfWeek: '$appointmentDate' },
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Service place distribution
    const servicePlaceDistribution = await Appointment.aggregate([
        {
            $match: {
                createdAt: { $gte: start, $lte: end }
            }
        },
        {
            $group: {
                _id: '$servicePlace',
                count: { $sum: 1 }
            }
        }
    ]);

    // Format appointment trends
    const formattedTrends = appointmentTrends.map(item => {
        let dateLabel = '';
        if (groupBy === 'week') {
            dateLabel = `${item._id.year}-W${String(item._id.week).padStart(2, '0')}`;
        } else if (groupBy === 'month') {
            dateLabel = `${item._id.year}-${String(item._id.month).padStart(2, '0')}`;
        } else {
            dateLabel = `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`;
        }
        return {
            date: dateLabel,
            total: item.count,
            completed: item.completed,
            cancelled: item.cancelled
        };
    });

    res.status(200).json({
        success: true,
        data: {
            dateRange: { start, end },
            summary: appointmentSummary[0] || {
                total: 0,
                pending: 0,
                confirmed: 0,
                completed: 0,
                cancelled: 0,
                avgValue: 0
            },
            trends: formattedTrends,
            statusDistribution: statusDistribution.map(item => ({
                status: item._id || 'unknown',
                count: item.count
            })),
            topServices: topServices.map(item => ({
                serviceId: item._id,
                serviceName: item.serviceName || 'Unknown Service',
                appointmentCount: item.count,
                revenue: item.revenue
            })),
            peakTimes: peakTimes.map(item => ({
                hour: item._id,
                timeSlot: `${String(item._id).padStart(2, '0')}:00`,
                count: item.count
            })),
            peakDays: peakDays.map(item => ({
                dayOfWeek: item._id,
                dayName: dayNames[item._id - 1] || 'Unknown',
                count: item.count
            })),
            servicePlaceDistribution: servicePlaceDistribution.map(item => ({
                place: item._id || 'unknown',
                count: item.count
            }))
        }
    });
});
