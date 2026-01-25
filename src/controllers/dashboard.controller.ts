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
 * For vendor users, shows only their own data
 */
export const getDashboardStats = asyncHandler(async (req: Request, res: Response) => {
    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check if user is a vendor
    let vendorId = null;
    if (req.user && req.user.role === 'vendor') {
        const vendor = await Vendor.findOne({ userId: req.user._id });
        if (vendor) {
            vendorId = vendor._id;
        }
    }

    if (vendorId) {
        // Get all vendor service IDs for this vendor
        const vendorServices = await VendorService.find({ vendorId }).select('_id');
        const serviceIds = vendorServices.map(vs => vs._id);
        const appointmentFilter = { vendorServiceId: { $in: serviceIds } };

        // Vendor-specific stats
        const [
            totalVendorServices,
            totalAppointments,
            todayAppointments,
            pendingAppointments,
            confirmedAppointments,
            completedAppointments,
        ] = await Promise.all([
            VendorService.countDocuments({ vendorId }),
            Appointment.countDocuments(appointmentFilter),
            Appointment.countDocuments({
                ...appointmentFilter,
                appointmentDate: { $gte: today, $lt: tomorrow }
            }),
            Appointment.countDocuments({ ...appointmentFilter, status: 'pending' }),
            Appointment.countDocuments({ ...appointmentFilter, status: 'confirmed' }),
            Appointment.countDocuments({ ...appointmentFilter, status: 'completed' }),
        ]);

        res.status(200).json({
            success: true,
            data: {
                totalVendorServices,
                totalAppointments,
                todayAppointments,
                pendingAppointments,
                confirmedAppointments,
                completedAppointments,
            }
        });
    } else {
        // Admin stats - show everything
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
    }
});

/**
 * Get chart data for dashboard
 * Supports date range filtering via query params: startDate, endDate
 * For vendor users, shows only their own data
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

    // Check if user is a vendor and get their service IDs
    let vendorServiceIds: any[] = [];
    if (req.user && req.user.role === 'vendor') {
        const vendor = await Vendor.findOne({ userId: req.user._id });
        if (vendor) {
            const vendorServices = await VendorService.find({ vendorId: vendor._id }).select('_id');
            vendorServiceIds = vendorServices.map(vs => vs._id);
        }
    }

    // Build base match condition
    const baseMatch: Record<string, any> = {
        createdAt: { $gte: start, $lte: end }
    };
    if (vendorServiceIds.length > 0) {
        baseMatch.vendorServiceId = { $in: vendorServiceIds };
    }

    // Get appointments grouped by day
    const appointmentsByDay = await Appointment.aggregate([
        {
            $match: baseMatch
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
            $match: baseMatch
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

    // Get new users by day (only for admin)
    let usersData: any[] = [];
    if (vendorServiceIds.length === 0) {
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

        usersData = usersByDay.map(item => ({
            date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
            users: item.count
        }));
    }

    // Get top services by appointments
    const topServicesMatch: Record<string, any> = {
        createdAt: { $gte: start, $lte: end }
    };
    if (vendorServiceIds.length > 0) {
        topServicesMatch.vendorServiceId = { $in: vendorServiceIds };
    }

    const topServices = await Appointment.aggregate([
        {
            $match: topServicesMatch
        },
        {
            $lookup: {
                from: 'vendorservices',
                localField: 'vendorServiceId',
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
                revenue: { $sum: { $ifNull: ['$total', '$serviceFee'] } }
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
