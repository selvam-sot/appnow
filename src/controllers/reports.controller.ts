import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.util';
import Appointment from '../models/appointment.model';
import User from '../models/user.model';
import VendorService from '../models/vendor-service.model';
import Vendor from '../models/vendor.model';

/**
 * Generate revenue report with detailed breakdown
 */
export const generateRevenueReport = asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate, groupBy = 'day', format = 'json' } = req.query;

    // Default to current month if no date range provided
    const end = endDate ? new Date(endDate as string) : new Date();
    end.setHours(23, 59, 59, 999);

    const start = startDate ? new Date(startDate as string) : new Date(end.getFullYear(), end.getMonth(), 1);
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

    // Revenue summary
    const revenueSummary = await Appointment.aggregate([
        {
            $match: {
                createdAt: { $gte: start, $lte: end }
            }
        },
        {
            $group: {
                _id: null,
                totalGross: { $sum: { $ifNull: ['$serviceFee', 0] } },
                totalDiscounts: { $sum: { $ifNull: ['$discountAmount', 0] } },
                totalWallet: { $sum: { $ifNull: ['$walletAmount', 0] } },
                totalNet: { $sum: { $ifNull: ['$total', '$serviceFee'] } },
                totalRefunded: {
                    $sum: {
                        $cond: [
                            { $in: ['$paymentStatus', ['refunded', 'partially_refunded']] },
                            { $ifNull: ['$refundAmount', 0] },
                            0
                        ]
                    }
                },
                completedPayments: {
                    $sum: { $cond: [{ $eq: ['$paymentStatus', 'completed'] }, 1, 0] }
                },
                pendingPayments: {
                    $sum: { $cond: [{ $eq: ['$paymentStatus', 'pending'] }, 1, 0] }
                },
                failedPayments: {
                    $sum: { $cond: [{ $eq: ['$paymentStatus', 'failed'] }, 1, 0] }
                },
                totalTransactions: { $sum: 1 },
                avgTransactionValue: { $avg: { $ifNull: ['$total', '$serviceFee'] } }
            }
        }
    ]);

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
                revenue: { $sum: { $ifNull: ['$total', '$serviceFee'] } },
                transactions: { $sum: 1 }
            }
        },
        {
            $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 }
        }
    ]);

    // Revenue by vendor (top 20)
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
                vendorEmail: { $first: '$vendor.vendorEmail' },
                totalRevenue: { $sum: { $ifNull: ['$total', '$serviceFee'] } },
                transactionCount: { $sum: 1 },
                avgOrderValue: { $avg: { $ifNull: ['$total', '$serviceFee'] } }
            }
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: 20 }
    ]);

    // Revenue by service category
    const revenueByCategory = await Appointment.aggregate([
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
                from: 'services',
                localField: 'vendorService.serviceId',
                foreignField: '_id',
                as: 'service'
            }
        },
        { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: 'categories',
                localField: 'service.categoryId',
                foreignField: '_id',
                as: 'category'
            }
        },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: '$category._id',
                categoryName: { $first: '$category.name' },
                totalRevenue: { $sum: { $ifNull: ['$total', '$serviceFee'] } },
                transactionCount: { $sum: 1 }
            }
        },
        { $sort: { totalRevenue: -1 } }
    ]);

    // Payment method breakdown
    const paymentMethodBreakdown = await Appointment.aggregate([
        {
            $match: {
                createdAt: { $gte: start, $lte: end },
                paymentStatus: 'completed'
            }
        },
        {
            $group: {
                _id: '$paymentMode',
                count: { $sum: 1 },
                amount: { $sum: { $ifNull: ['$total', '$serviceFee'] } }
            }
        }
    ]);

    // Format revenue by period
    const formatPeriod = (item: any) => {
        let dateLabel = '';
        if (groupBy === 'week') {
            dateLabel = `${item._id.year}-W${String(item._id.week).padStart(2, '0')}`;
        } else if (groupBy === 'month') {
            dateLabel = `${item._id.year}-${String(item._id.month).padStart(2, '0')}`;
        } else {
            dateLabel = `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`;
        }
        return {
            period: dateLabel,
            revenue: item.revenue,
            transactions: item.transactions
        };
    };

    const report = {
        reportType: 'Revenue Report',
        dateRange: { start, end },
        generatedAt: new Date(),
        summary: revenueSummary[0] || {
            totalGross: 0,
            totalDiscounts: 0,
            totalWallet: 0,
            totalNet: 0,
            totalRefunded: 0,
            completedPayments: 0,
            pendingPayments: 0,
            failedPayments: 0,
            totalTransactions: 0,
            avgTransactionValue: 0
        },
        revenueByPeriod: revenueByPeriod.map(formatPeriod),
        revenueByVendor,
        revenueByCategory: revenueByCategory.map(item => ({
            categoryId: item._id,
            categoryName: item.categoryName || 'Uncategorized',
            totalRevenue: item.totalRevenue,
            transactionCount: item.transactionCount
        })),
        paymentMethodBreakdown: paymentMethodBreakdown.map(item => ({
            method: item._id || 'unknown',
            count: item.count,
            amount: item.amount
        }))
    };

    res.status(200).json({
        success: true,
        data: report
    });
});

/**
 * Generate user activity report
 */
export const generateUserReport = asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate, groupBy = 'day' } = req.query;

    // Default to current month if no date range provided
    const end = endDate ? new Date(endDate as string) : new Date();
    end.setHours(23, 59, 59, 999);

    const start = startDate ? new Date(startDate as string) : new Date(end.getFullYear(), end.getMonth(), 1);
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

    // User summary
    const userSummary = await User.aggregate([
        {
            $facet: {
                total: [{ $count: 'count' }],
                active: [
                    { $match: { isActive: true } },
                    { $count: 'count' }
                ],
                newInPeriod: [
                    { $match: { createdAt: { $gte: start, $lte: end } } },
                    { $count: 'count' }
                ],
                byRole: [
                    { $group: { _id: '$role', count: { $sum: 1 } } }
                ],
                byAuthProvider: [
                    { $group: { _id: '$authProvider', count: { $sum: 1 } } }
                ]
            }
        }
    ]);

    // User growth over time
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

    // User engagement (users with appointments)
    const userEngagement = await Appointment.aggregate([
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
        {
            $facet: {
                engagement: [
                    {
                        $bucket: {
                            groupBy: '$appointmentCount',
                            boundaries: [1, 2, 3, 5, 10, 20, 100],
                            default: '20+',
                            output: {
                                count: { $sum: 1 },
                                avgSpent: { $avg: '$totalSpent' }
                            }
                        }
                    }
                ],
                topUsers: [
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
                ],
                totalActiveUsers: [
                    { $count: 'count' }
                ]
            }
        }
    ]);

    // User retention
    const retentionData = await Appointment.aggregate([
        {
            $group: {
                _id: '$customerId',
                firstAppointment: { $min: '$createdAt' },
                lastAppointment: { $max: '$createdAt' },
                appointmentCount: { $sum: 1 }
            }
        },
        {
            $group: {
                _id: null,
                oneTimeUsers: {
                    $sum: { $cond: [{ $eq: ['$appointmentCount', 1] }, 1, 0] }
                },
                returningUsers: {
                    $sum: { $cond: [{ $gt: ['$appointmentCount', 1] }, 1, 0] }
                },
                total: { $sum: 1 }
            }
        }
    ]);

    // Format user growth
    const formatPeriod = (item: any) => {
        let dateLabel = '';
        if (groupBy === 'week') {
            dateLabel = `${item._id.year}-W${String(item._id.week).padStart(2, '0')}`;
        } else if (groupBy === 'month') {
            dateLabel = `${item._id.year}-${String(item._id.month).padStart(2, '0')}`;
        } else {
            dateLabel = `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`;
        }
        return {
            period: dateLabel,
            newUsers: item.newUsers
        };
    };

    const summaryData = userSummary[0];
    const engagementData = userEngagement[0];
    const retention = retentionData[0];

    const report = {
        reportType: 'User Activity Report',
        dateRange: { start, end },
        generatedAt: new Date(),
        summary: {
            totalUsers: summaryData?.total[0]?.count || 0,
            activeUsers: summaryData?.active[0]?.count || 0,
            newUsersInPeriod: summaryData?.newInPeriod[0]?.count || 0,
            activeUsersInPeriod: engagementData?.totalActiveUsers[0]?.count || 0,
            byRole: summaryData?.byRole?.map((r: any) => ({
                role: r._id || 'unknown',
                count: r.count
            })) || [],
            byAuthProvider: summaryData?.byAuthProvider?.map((p: any) => ({
                provider: p._id || 'local',
                count: p.count
            })) || []
        },
        userGrowth: userGrowth.map(formatPeriod),
        engagementDistribution: engagementData?.engagement?.map((e: any) => ({
            appointmentRange: e._id === '20+' ? '20+' : `${e._id}-${e._id}`,
            userCount: e.count,
            avgSpent: Math.round(e.avgSpent * 100) / 100
        })) || [],
        topUsers: engagementData?.topUsers || [],
        retention: retention ? {
            oneTimeUsers: retention.oneTimeUsers,
            returningUsers: retention.returningUsers,
            totalUsersWithAppointments: retention.total,
            retentionRate: retention.total > 0
                ? Math.round((retention.returningUsers / retention.total) * 100)
                : 0
        } : {
            oneTimeUsers: 0,
            returningUsers: 0,
            totalUsersWithAppointments: 0,
            retentionRate: 0
        }
    };

    res.status(200).json({
        success: true,
        data: report
    });
});

/**
 * Generate appointment summary report
 */
export const generateAppointmentReport = asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate, groupBy = 'day' } = req.query;

    // Default to current month if no date range provided
    const end = endDate ? new Date(endDate as string) : new Date();
    end.setHours(23, 59, 59, 999);

    const start = startDate ? new Date(startDate as string) : new Date(end.getFullYear(), end.getMonth(), 1);
    start.setHours(0, 0, 0, 0);

    // Get date grouping format
    const getDateGroup = () => {
        switch (groupBy) {
            case 'week':
                return {
                    year: { $year: '$appointmentDate' },
                    week: { $week: '$appointmentDate' }
                };
            case 'month':
                return {
                    year: { $year: '$appointmentDate' },
                    month: { $month: '$appointmentDate' }
                };
            default:
                return {
                    year: { $year: '$appointmentDate' },
                    month: { $month: '$appointmentDate' },
                    day: { $dayOfMonth: '$appointmentDate' }
                };
        }
    };

    // Appointment summary
    const appointmentSummary = await Appointment.aggregate([
        {
            $match: {
                appointmentDate: { $gte: start, $lte: end }
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
                totalRevenue: {
                    $sum: {
                        $cond: [
                            { $eq: ['$paymentStatus', 'completed'] },
                            { $ifNull: ['$total', '$serviceFee'] },
                            0
                        ]
                    }
                }
            }
        }
    ]);

    // Appointments over time
    const appointmentsByPeriod = await Appointment.aggregate([
        {
            $match: {
                appointmentDate: { $gte: start, $lte: end }
            }
        },
        {
            $group: {
                _id: getDateGroup(),
                total: { $sum: 1 },
                completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } }
            }
        },
        {
            $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 }
        }
    ]);

    // Top services by appointments
    const topServices = await Appointment.aggregate([
        {
            $match: {
                appointmentDate: { $gte: start, $lte: end }
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
                appointmentCount: { $sum: 1 },
                completedCount: {
                    $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                },
                revenue: {
                    $sum: {
                        $cond: [
                            { $eq: ['$paymentStatus', 'completed'] },
                            { $ifNull: ['$total', '$serviceFee'] },
                            0
                        ]
                    }
                }
            }
        },
        { $sort: { appointmentCount: -1 } },
        { $limit: 15 }
    ]);

    // Service place distribution
    const servicePlaceDistribution = await Appointment.aggregate([
        {
            $match: {
                appointmentDate: { $gte: start, $lte: end }
            }
        },
        {
            $group: {
                _id: '$servicePlace',
                count: { $sum: 1 }
            }
        }
    ]);

    // Cancellation reasons
    const cancellationReasons = await Appointment.aggregate([
        {
            $match: {
                appointmentDate: { $gte: start, $lte: end },
                status: 'cancelled'
            }
        },
        {
            $group: {
                _id: '$cancellationReason',
                count: { $sum: 1 }
            }
        },
        { $sort: { count: -1 } }
    ]);

    // Format appointments by period
    const formatPeriod = (item: any) => {
        let dateLabel = '';
        if (groupBy === 'week') {
            dateLabel = `${item._id.year}-W${String(item._id.week).padStart(2, '0')}`;
        } else if (groupBy === 'month') {
            dateLabel = `${item._id.year}-${String(item._id.month).padStart(2, '0')}`;
        } else {
            dateLabel = `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`;
        }
        return {
            period: dateLabel,
            total: item.total,
            completed: item.completed,
            cancelled: item.cancelled,
            completionRate: item.total > 0 ? Math.round((item.completed / item.total) * 100) : 0
        };
    };

    const summary = appointmentSummary[0] || {
        total: 0,
        pending: 0,
        confirmed: 0,
        completed: 0,
        cancelled: 0,
        totalRevenue: 0
    };

    const report = {
        reportType: 'Appointment Report',
        dateRange: { start, end },
        generatedAt: new Date(),
        summary: {
            ...summary,
            completionRate: summary.total > 0
                ? Math.round((summary.completed / summary.total) * 100)
                : 0,
            cancellationRate: summary.total > 0
                ? Math.round((summary.cancelled / summary.total) * 100)
                : 0
        },
        appointmentsByPeriod: appointmentsByPeriod.map(formatPeriod),
        topServices: topServices.map(item => ({
            serviceId: item._id,
            serviceName: item.serviceName || 'Unknown Service',
            appointmentCount: item.appointmentCount,
            completedCount: item.completedCount,
            revenue: item.revenue,
            completionRate: item.appointmentCount > 0
                ? Math.round((item.completedCount / item.appointmentCount) * 100)
                : 0
        })),
        servicePlaceDistribution: servicePlaceDistribution.map(item => ({
            place: item._id || 'unknown',
            count: item.count
        })),
        cancellationReasons: cancellationReasons.map(item => ({
            reason: item._id || 'Not specified',
            count: item.count
        }))
    };

    res.status(200).json({
        success: true,
        data: report
    });
});
