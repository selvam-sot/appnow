import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.util';
import Category from '../models/category.model';
import SubCategory from '../models/sub-category.model';
import Service from '../models/service.model';
import Vendor from '../models/vendor.model';
import VendorService from '../models/vendor-service.model';
import Appointment from '../models/appointment.model';
import User from '../models/user.model';

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
