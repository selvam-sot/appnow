import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.util';
import AuditLog from '../models/audit-log.model';

/**
 * Get audit logs with filtering and pagination
 */
export const getAuditLogs = asyncHandler(async (req: Request, res: Response) => {
    const {
        page = 1,
        limit = 50,
        userId,
        action,
        resource,
        startDate,
        endDate,
        statusCode,
        sortBy = 'createdAt',
        sortOrder = 'desc'
    } = req.query;

    // Build query
    const query: any = {};

    if (userId) {
        query.userId = userId;
    }

    if (action) {
        query.action = action;
    }

    if (resource) {
        query.resource = resource;
    }

    if (statusCode) {
        query.statusCode = parseInt(statusCode as string, 10);
    }

    // Date range filter
    if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) {
            query.createdAt.$gte = new Date(startDate as string);
        }
        if (endDate) {
            query.createdAt.$lte = new Date(endDate as string);
        }
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100); // Max 100 per page
    const skip = (pageNum - 1) * limitNum;

    // Build sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const [logs, total] = await Promise.all([
        AuditLog.find(query)
            .sort(sort)
            .skip(skip)
            .limit(limitNum)
            .populate('userId', 'firstName lastName email')
            .lean(),
        AuditLog.countDocuments(query)
    ]);

    res.status(200).json({
        success: true,
        data: {
            logs,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum)
            }
        }
    });
});

/**
 * Get audit log by ID
 */
export const getAuditLogById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const log = await AuditLog.findById(id)
        .populate('userId', 'firstName lastName email')
        .lean();

    if (!log) {
        return res.status(404).json({
            success: false,
            message: 'Audit log not found'
        });
    }

    res.status(200).json({
        success: true,
        data: log
    });
});

/**
 * Get audit log summary/statistics
 */
export const getAuditLogStats = asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;

    // Default to last 7 days
    const end = endDate ? new Date(endDate as string) : new Date();
    end.setHours(23, 59, 59, 999);

    const start = startDate ? new Date(startDate as string) : new Date(end);
    if (!startDate) {
        start.setDate(start.getDate() - 7);
    }
    start.setHours(0, 0, 0, 0);

    const dateFilter = {
        createdAt: { $gte: start, $lte: end }
    };

    // Get stats in parallel
    const [
        totalLogs,
        actionBreakdown,
        resourceBreakdown,
        statusCodeBreakdown,
        activityByDay,
        topUsers,
        errorLogs
    ] = await Promise.all([
        // Total logs in period
        AuditLog.countDocuments(dateFilter),

        // Breakdown by action
        AuditLog.aggregate([
            { $match: dateFilter },
            { $group: { _id: '$action', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]),

        // Breakdown by resource
        AuditLog.aggregate([
            { $match: dateFilter },
            { $group: { _id: '$resource', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]),

        // Breakdown by status code
        AuditLog.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: {
                        $switch: {
                            branches: [
                                { case: { $lt: ['$statusCode', 300] }, then: '2xx' },
                                { case: { $lt: ['$statusCode', 400] }, then: '3xx' },
                                { case: { $lt: ['$statusCode', 500] }, then: '4xx' },
                                { case: { $gte: ['$statusCode', 500] }, then: '5xx' }
                            ],
                            default: 'other'
                        }
                    },
                    count: { $sum: 1 }
                }
            }
        ]),

        // Activity by day
        AuditLog.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                        day: { $dayOfMonth: '$createdAt' }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ]),

        // Top users by activity
        AuditLog.aggregate([
            { $match: { ...dateFilter, userId: { $exists: true, $ne: null } } },
            { $group: { _id: '$userId', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
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
                    count: 1,
                    email: '$user.email',
                    firstName: '$user.firstName',
                    lastName: '$user.lastName'
                }
            }
        ]),

        // Recent errors
        AuditLog.find({ ...dateFilter, statusCode: { $gte: 400 } })
            .sort({ createdAt: -1 })
            .limit(10)
            .lean()
    ]);

    res.status(200).json({
        success: true,
        data: {
            dateRange: { start, end },
            totalLogs,
            actionBreakdown: actionBreakdown.map(item => ({
                action: item._id,
                count: item.count
            })),
            resourceBreakdown: resourceBreakdown.map(item => ({
                resource: item._id,
                count: item.count
            })),
            statusCodeBreakdown: statusCodeBreakdown.map(item => ({
                statusGroup: item._id,
                count: item.count
            })),
            activityByDay: activityByDay.map(item => ({
                date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
                count: item.count
            })),
            topUsers,
            recentErrors: errorLogs
        }
    });
});

/**
 * Get user activity from audit logs
 */
export const getUserActivity = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
        AuditLog.find({ userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
        AuditLog.countDocuments({ userId })
    ]);

    res.status(200).json({
        success: true,
        data: {
            logs,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum)
            }
        }
    });
});
