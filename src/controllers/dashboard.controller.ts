import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.util';
import Category from '../models/category.model';
import SubCategory from '../models/sub-category.model';
import Service from '../models/service.model';
import Vendor from '../models/vendor.model';
import VendorService from '../models/vendor-service.model';
import Appointment from '../models/appointment.model';
import User from '../models/user.model';

/**
 * Get dashboard statistics (counts)
 */
export const getDashboardStats = asyncHandler(async (req: Request, res: Response) => {
    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Run all count queries in parallel for better performance
    const [
        totalCategories,
        totalSubCategories,
        totalServices,
        totalVendors,
        totalVendorServices,
        totalAppointments,
        totalUsers,
        todayAppointments,
        pendingAppointments,
        confirmedAppointments,
    ] = await Promise.all([
        Category.countDocuments(),
        SubCategory.countDocuments(),
        Service.countDocuments(),
        Vendor.countDocuments(),
        VendorService.countDocuments(),
        Appointment.countDocuments(),
        User.countDocuments(),
        Appointment.countDocuments({
            appointmentDate: { $gte: today, $lt: tomorrow }
        }),
        Appointment.countDocuments({ status: 'pending' }),
        Appointment.countDocuments({ status: 'confirmed' }),
    ]);

    res.status(200).json({
        success: true,
        data: {
            totalCategories,
            totalSubCategories,
            totalServices,
            totalVendors,
            totalVendorServices,
            totalAppointments,
            totalUsers,
            todayAppointments,
            pendingAppointments,
            confirmedAppointments,
        }
    });
});

/**
 * Get chart data for dashboard
 * Supports date range filtering via query params: startDate, endDate
 */
export const getDashboardCharts = asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;

    // Default to last 30 days if no date range provided
    const end = endDate ? new Date(endDate as string) : new Date();
    end.setHours(23, 59, 59, 999);

    const start = startDate ? new Date(startDate as string) : new Date(end);
    if (!startDate) {
        start.setDate(start.getDate() - 30);
    }
    start.setHours(0, 0, 0, 0);

    // Get appointments grouped by day
    const appointmentsByDay = await Appointment.aggregate([
        {
            $match: {
                createdAt: { $gte: start, $lte: end }
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                    day: { $dayOfMonth: '$createdAt' }
                },
                count: { $sum: 1 },
                revenue: { $sum: { $ifNull: ['$price', 0] } }
            }
        },
        {
            $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
        }
    ]);

    // Format appointments data for charts
    const appointmentsData = appointmentsByDay.map(item => ({
        date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
        appointments: item.count,
        revenue: item.revenue
    }));

    // Get appointments by status
    const appointmentsByStatus = await Appointment.aggregate([
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

    const statusData = appointmentsByStatus.map(item => ({
        status: item._id || 'unknown',
        count: item.count
    }));

    // Get new users by day
    const usersByDay = await User.aggregate([
        {
            $match: {
                createdAt: { $gte: start, $lte: end }
            }
        },
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
        {
            $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
        }
    ]);

    const usersData = usersByDay.map(item => ({
        date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
        users: item.count
    }));

    // Get top services by appointments
    const topServices = await Appointment.aggregate([
        {
            $match: {
                createdAt: { $gte: start, $lte: end }
            }
        },
        {
            $lookup: {
                from: 'vendorservices',
                localField: 'vendorService',
                foreignField: '_id',
                as: 'serviceDetails'
            }
        },
        {
            $unwind: { path: '$serviceDetails', preserveNullAndEmptyArrays: true }
        },
        {
            $group: {
                _id: '$serviceDetails.name',
                count: { $sum: 1 },
                revenue: { $sum: { $ifNull: ['$price', 0] } }
            }
        },
        {
            $sort: { count: -1 }
        },
        {
            $limit: 5
        }
    ]);

    const topServicesData = topServices.map(item => ({
        name: item._id || 'Unknown Service',
        appointments: item.count,
        revenue: item.revenue
    }));

    res.status(200).json({
        success: true,
        data: {
            dateRange: { start, end },
            appointmentsData,
            statusData,
            usersData,
            topServicesData
        }
    });
});
