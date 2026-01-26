import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.util';
import { AppError } from '../utils/appError.util';
import Vendor from '../models/vendor.model';
import VendorService from '../models/vendor-service.model';
import VendorServiceSlot from '../models/vendor-service-slot.model';
import Appointment from '../models/appointment.model';
import User from '../models/user.model';
import Review from '../models/review.model';
import Category from '../models/category.model';
import SubCategory from '../models/sub-category.model';
import Service from '../models/service.model';

/**
 * Sync vendor user from Clerk
 * Creates or updates user and vendor records
 */
export const syncVendor = asyncHandler(async (req: Request, res: Response) => {
    const { clerkId, email, firstName, lastName, businessName, phone } = req.body;

    if (!clerkId || !email) {
        throw new AppError('Clerk ID and email are required', 400);
    }

    // Find or create user
    let user = await User.findOne({
        $or: [
            { clerkId: clerkId },
            { email: email }
        ]
    });

    if (user) {
        // Update existing user
        user.clerkId = clerkId;
        user.authProvider = 'clerk';
        user.email = email;
        user.firstName = firstName || user.firstName;
        user.lastName = lastName || user.lastName;
        user.role = 'vendor';
        user.isActive = true;
        user.lastSyncedAt = new Date();
        await user.save();
    } else {
        // Create new user with vendor role
        user = await User.create({
            clerkId,
            email,
            firstName: firstName || '',
            lastName: lastName || '',
            authProvider: 'clerk',
            role: 'vendor',
            isActive: true,
            lastSyncedAt: new Date()
        });
    }

    // Find vendor profile by userId or email
    let vendor = await Vendor.findOne({
        $or: [
            { userId: user._id },
            { email: email }
        ]
    });

    if (!vendor) {
        // Create vendor profile linked to user
        vendor = await Vendor.create({
            vendorName: businessName || `${firstName || ''} ${lastName || ''}`.trim() || 'New Vendor',
            email: email,
            phone: phone || '',
            country: 'USA',
            state: '',
            city: '',
            zip: '',
            address1: '',
            verificationStatus: 'pending',
            isActive: true,
            userId: user._id
        });
    } else {
        // Update vendor - link to user if not already linked
        let needsSave = false;
        if (!(vendor as any).userId) {
            (vendor as any).userId = user._id;
            needsSave = true;
        }
        if (businessName && vendor.vendorName !== businessName) {
            vendor.vendorName = businessName;
            needsSave = true;
        }
        if (needsSave) {
            await vendor.save();
        }
    }

    res.status(200).json({
        success: true,
        data: {
            id: user._id,
            clerkId: user.clerkId,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            vendorId: vendor._id,
            businessName: vendor.vendorName,
            isVerified: vendor.verificationStatus === 'verified',
            verificationStatus: vendor.verificationStatus,
            rating: vendor.rating || 0,
            reviewCount: 0
        }
    });
});

/**
 * Get vendor dashboard stats
 */
export const getDashboardStats = asyncHandler(async (req: Request, res: Response) => {
    const vendorId = req.vendorId;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // Get vendor services
    const vendorServices = await VendorService.find({ vendorId }).select('_id');
    const serviceIds = vendorServices.map(s => s._id);

    // Get stats in parallel
    const [
        todayAppointments,
        pendingAppointments,
        monthlyAppointments,
        monthlyRevenue,
        totalCustomers,
        avgRating
    ] = await Promise.all([
        // Today's appointments
        Appointment.countDocuments({
            vendorServiceId: { $in: serviceIds },
            appointmentDate: { $gte: today, $lt: tomorrow }
        }),
        // Pending appointments
        Appointment.countDocuments({
            vendorServiceId: { $in: serviceIds },
            status: 'pending'
        }),
        // This month appointments
        Appointment.countDocuments({
            vendorServiceId: { $in: serviceIds },
            appointmentDate: { $gte: thisMonthStart }
        }),
        // Monthly revenue
        Appointment.aggregate([
            {
                $match: {
                    vendorServiceId: { $in: serviceIds },
                    createdAt: { $gte: thisMonthStart },
                    paymentStatus: 'completed'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: { $ifNull: ['$total', '$serviceFee'] } }
                }
            }
        ]),
        // Unique customers
        Appointment.distinct('customerId', {
            vendorServiceId: { $in: serviceIds }
        }).then(ids => ids.length),
        // Average rating
        Review.aggregate([
            { $match: { vendorId } },
            { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
        ])
    ]);

    res.status(200).json({
        success: true,
        data: {
            todayBookings: todayAppointments,
            pendingBookings: pendingAppointments,
            monthlyBookings: monthlyAppointments,
            monthlyRevenue: monthlyRevenue[0]?.total || 0,
            totalCustomers,
            rating: avgRating[0]?.avgRating?.toFixed(1) || 0,
            reviewCount: avgRating[0]?.count || 0
        }
    });
});

/**
 * Get today's appointments for vendor
 */
export const getTodayAppointments = asyncHandler(async (req: Request, res: Response) => {
    const vendorId = req.vendorId;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const vendorServices = await VendorService.find({ vendorId }).select('_id');
    const serviceIds = vendorServices.map(s => s._id);

    const appointments = await Appointment.find({
        vendorServiceId: { $in: serviceIds },
        appointmentDate: { $gte: today, $lt: tomorrow }
    })
        .populate('customerId', 'firstName lastName email phone')
        .populate({
            path: 'vendorServiceId',
            populate: { path: 'serviceId', select: 'name' }
        })
        .sort({ startTime: 1 })
        .lean();

    res.status(200).json({
        success: true,
        data: appointments.map(apt => ({
            id: apt._id,
            customerName: `${(apt.customerId as any)?.firstName || ''} ${(apt.customerId as any)?.lastName || ''}`.trim(),
            customerPhone: (apt.customerId as any)?.phone,
            customerEmail: (apt.customerId as any)?.email,
            serviceName: (apt.vendorServiceId as any)?.serviceId?.name || 'Service',
            date: apt.appointmentDate,
            time: apt.startTime,
            endTime: apt.endTime,
            status: apt.status,
            price: apt.total || apt.serviceFee,
            paymentStatus: apt.paymentStatus
        }))
    });
});

/**
 * Get vendor appointments with filters
 */
export const getAppointments = asyncHandler(async (req: Request, res: Response) => {
    const vendorId = req.vendorId;
    const { status, page = 1, limit = 20, startDate, endDate } = req.query;

    const vendorServices = await VendorService.find({ vendorId }).select('_id');
    const serviceIds = vendorServices.map(s => s._id);

    const query: any = { vendorServiceId: { $in: serviceIds } };

    if (status && status !== 'all') {
        query.status = status;
    }

    if (startDate || endDate) {
        query.appointmentDate = {};
        if (startDate) query.appointmentDate.$gte = new Date(startDate as string);
        if (endDate) query.appointmentDate.$lte = new Date(endDate as string);
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [appointments, total] = await Promise.all([
        Appointment.find(query)
            .populate('customerId', 'firstName lastName email phone')
            .populate({
                path: 'vendorServiceId',
                populate: { path: 'serviceId', select: 'name' }
            })
            .sort({ appointmentDate: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
        Appointment.countDocuments(query)
    ]);

    res.status(200).json({
        success: true,
        data: {
            appointments: appointments.map(apt => ({
                id: apt._id,
                customerName: `${(apt.customerId as any)?.firstName || ''} ${(apt.customerId as any)?.lastName || ''}`.trim(),
                customerPhone: (apt.customerId as any)?.phone,
                customerEmail: (apt.customerId as any)?.email,
                serviceName: (apt.vendorServiceId as any)?.serviceId?.name || 'Service',
                date: apt.appointmentDate,
                time: apt.startTime,
                endTime: apt.endTime,
                duration: `${Math.round(((new Date(`1970-01-01T${apt.endTime}`).getTime() - new Date(`1970-01-01T${apt.startTime}`).getTime()) / 60000))} min`,
                status: apt.status,
                price: apt.total || apt.serviceFee,
                paymentStatus: apt.paymentStatus,
                servicePlace: apt.servicePlace,
                customerNotes: apt.customerNotes,
                createdAt: apt.createdAt
            })),
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
 * Confirm appointment
 */
export const confirmAppointment = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const vendorId = req.vendorId;

    const vendorServices = await VendorService.find({ vendorId }).select('_id');
    const serviceIds = vendorServices.map(s => s._id.toString());

    const appointment = await Appointment.findById(id);

    if (!appointment) {
        throw new AppError('Appointment not found', 404);
    }

    if (!serviceIds.includes(appointment.vendorServiceId.toString())) {
        throw new AppError('Not authorized to access this appointment', 403);
    }

    if (appointment.status !== 'pending') {
        throw new AppError('Only pending appointments can be confirmed', 400);
    }

    appointment.status = 'confirmed';
    await appointment.save();

    res.status(200).json({
        success: true,
        message: 'Appointment confirmed successfully'
    });
});

/**
 * Decline appointment
 */
export const declineAppointment = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { reason } = req.body;
    const vendorId = req.vendorId;

    const vendorServices = await VendorService.find({ vendorId }).select('_id');
    const serviceIds = vendorServices.map(s => s._id.toString());

    const appointment = await Appointment.findById(id);

    if (!appointment) {
        throw new AppError('Appointment not found', 404);
    }

    if (!serviceIds.includes(appointment.vendorServiceId.toString())) {
        throw new AppError('Not authorized to access this appointment', 403);
    }

    if (appointment.status !== 'pending') {
        throw new AppError('Only pending appointments can be declined', 400);
    }

    appointment.status = 'cancelled';
    appointment.cancellationReason = reason || 'Declined by vendor';
    appointment.cancelledAt = new Date();
    await appointment.save();

    // TODO: Initiate refund if payment was completed

    res.status(200).json({
        success: true,
        message: 'Appointment declined successfully'
    });
});

/**
 * Complete appointment
 */
export const completeAppointment = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const vendorId = req.vendorId;

    const vendorServices = await VendorService.find({ vendorId }).select('_id');
    const serviceIds = vendorServices.map(s => s._id.toString());

    const appointment = await Appointment.findById(id);

    if (!appointment) {
        throw new AppError('Appointment not found', 404);
    }

    if (!serviceIds.includes(appointment.vendorServiceId.toString())) {
        throw new AppError('Not authorized to access this appointment', 403);
    }

    if (appointment.status !== 'confirmed') {
        throw new AppError('Only confirmed appointments can be marked as completed', 400);
    }

    appointment.status = 'completed';
    await appointment.save();

    res.status(200).json({
        success: true,
        message: 'Appointment marked as completed'
    });
});

/**
 * Get vendor services
 */
export const getVendorServices = asyncHandler(async (req: Request, res: Response) => {
    const vendorId = req.vendorId;

    const services = await VendorService.find({ vendorId })
        .populate('serviceId', 'name description')
        .populate('categoryId', 'name')
        .lean();

    // Get booking counts for each service
    const serviceIds = services.map(s => s._id);
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const bookingCounts = await Appointment.aggregate([
        {
            $match: {
                vendorServiceId: { $in: serviceIds },
                createdAt: { $gte: thisMonth }
            }
        },
        {
            $group: {
                _id: '$vendorServiceId',
                count: { $sum: 1 }
            }
        }
    ]);

    const countMap = new Map(bookingCounts.map(b => [b._id.toString(), b.count]));

    res.status(200).json({
        success: true,
        data: services.map(service => ({
            id: service._id,
            name: (service.serviceId as any)?.name || 'Service',
            description: service.description || (service.serviceId as any)?.description,
            categoryName: (service.categoryId as any)?.name,
            price: service.price,
            duration: service.duration,
            isActive: service.isActive !== false,
            images: service.images,
            bookingsThisMonth: countMap.get(service._id.toString()) || 0
        }))
    });
});

/**
 * Toggle service status
 */
export const toggleServiceStatus = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { isActive } = req.body;
    const vendorId = req.vendorId;

    const service = await VendorService.findOne({ _id: id, vendorId });

    if (!service) {
        throw new AppError('Service not found', 404);
    }

    service.isActive = isActive;
    await service.save();

    res.status(200).json({
        success: true,
        message: `Service ${isActive ? 'activated' : 'deactivated'} successfully`
    });
});

/**
 * Get vendor earnings
 */
export const getEarnings = asyncHandler(async (req: Request, res: Response) => {
    const vendorId = req.vendorId;
    const { period = 'month' } = req.query;

    const vendorServices = await VendorService.find({ vendorId }).select('_id');
    const serviceIds = vendorServices.map(s => s._id);

    // Calculate date range
    const now = new Date();
    let startDate: Date;

    switch (period) {
        case 'week':
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 7);
            break;
        case 'year':
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
        default: // month
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const earnings = await Appointment.aggregate([
        {
            $match: {
                vendorServiceId: { $in: serviceIds },
                createdAt: { $gte: startDate },
                paymentStatus: 'completed'
            }
        },
        {
            $group: {
                _id: null,
                totalRevenue: { $sum: { $ifNull: ['$total', '$serviceFee'] } },
                bookingCount: { $sum: 1 },
                avgOrderValue: { $avg: { $ifNull: ['$total', '$serviceFee'] } }
            }
        }
    ]);

    res.status(200).json({
        success: true,
        data: {
            period,
            totalRevenue: earnings[0]?.totalRevenue || 0,
            bookingCount: earnings[0]?.bookingCount || 0,
            avgOrderValue: Math.round((earnings[0]?.avgOrderValue || 0) * 100) / 100
        }
    });
});

/**
 * Get vendor transactions
 */
export const getTransactions = asyncHandler(async (req: Request, res: Response) => {
    const vendorId = req.vendorId;
    const { page = 1, limit = 20 } = req.query;

    const vendorServices = await VendorService.find({ vendorId }).select('_id');
    const serviceIds = vendorServices.map(s => s._id);

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [transactions, total] = await Promise.all([
        Appointment.find({
            vendorServiceId: { $in: serviceIds },
            paymentIntentId: { $exists: true }
        })
            .populate('customerId', 'firstName lastName')
            .populate({
                path: 'vendorServiceId',
                populate: { path: 'serviceId', select: 'name' }
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
        Appointment.countDocuments({
            vendorServiceId: { $in: serviceIds },
            paymentIntentId: { $exists: true }
        })
    ]);

    res.status(200).json({
        success: true,
        data: {
            transactions: transactions.map(t => ({
                id: t._id,
                customerName: `${(t.customerId as any)?.firstName || ''} ${(t.customerId as any)?.lastName || ''}`.trim(),
                serviceName: (t.vendorServiceId as any)?.serviceId?.name || 'Service',
                amount: t.total || t.serviceFee,
                status: t.paymentStatus,
                refundAmount: t.refundAmount,
                date: t.createdAt
            })),
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
 * Get vendor profile
 */
export const getProfile = asyncHandler(async (req: Request, res: Response) => {
    const vendorId = req.vendorId;

    const vendor = await Vendor.findById(vendorId).lean();

    if (!vendor) {
        throw new AppError('Vendor not found', 404);
    }

    res.status(200).json({
        success: true,
        data: vendor
    });
});

/**
 * Update vendor profile
 */
export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
    const vendorId = req.vendorId;
    const updates = req.body;

    // Fields that can be updated
    const allowedFields = [
        'vendorName', 'vendorEmail', 'vendorPhone', 'vendorLogo',
        'aboutContent', 'address1', 'address2', 'city', 'state', 'zip',
        'website', 'socialLinks'
    ];

    const filteredUpdates: any = {};
    for (const field of allowedFields) {
        if (updates[field] !== undefined) {
            filteredUpdates[field] = updates[field];
        }
    }

    const vendor = await Vendor.findByIdAndUpdate(
        vendorId,
        filteredUpdates,
        { new: true }
    );

    if (!vendor) {
        throw new AppError('Vendor not found', 404);
    }

    res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: vendor
    });
});

/**
 * Get vendor reviews
 */
export const getReviews = asyncHandler(async (req: Request, res: Response) => {
    const vendorId = req.vendorId;
    const { page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [reviews, total] = await Promise.all([
        Review.find({ vendorId })
            .populate('customerId', 'firstName lastName')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
        Review.countDocuments({ vendorId })
    ]);

    res.status(200).json({
        success: true,
        data: {
            reviews: reviews.map(r => ({
                id: r._id,
                customerName: `${(r.customerId as any)?.firstName || ''} ${(r.customerId as any)?.lastName || ''}`.trim(),
                rating: r.rating,
                title: r.title,
                comment: r.comment,
                reply: r.vendorResponse?.comment,
                replyDate: r.vendorResponse?.respondedAt,
                createdAt: r.createdAt
            })),
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
 * Reply to review
 */
export const replyToReview = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { reply } = req.body;
    const vendorId = req.vendorId;

    const review = await Review.findOne({ _id: id, vendorId });

    if (!review) {
        throw new AppError('Review not found', 404);
    }

    review.vendorResponse = {
        comment: reply,
        respondedAt: new Date()
    };
    await review.save();

    res.status(200).json({
        success: true,
        message: 'Reply added successfully'
    });
});

/**
 * Get categories for service creation
 */
export const getCategories = asyncHandler(async (req: Request, res: Response) => {
    const categories = await Category.find({ isActive: true }).lean();

    res.status(200).json({
        success: true,
        data: categories.map(cat => ({
            _id: cat._id,
            name: (cat as any).name || cat.categoryName,
            description: cat.description
        }))
    });
});

/**
 * Get a specific vendor service by ID
 */
export const getVendorServiceById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const vendorId = req.vendorId;

    const service = await VendorService.findOne({ _id: id, vendorId })
        .populate('categoryId', 'name')
        .populate('subCategoryId', 'name')
        .populate('serviceId', 'name description')
        .lean();

    if (!service) {
        throw new AppError('Service not found', 404);
    }

    res.status(200).json({
        success: true,
        data: {
            id: service._id,
            name: service.name,
            description: service.description,
            category: service.categoryId,
            subCategory: service.subCategoryId,
            price: service.price,
            duration: service.duration,
            isActive: service.isActive,
            images: service.images
        }
    });
});

/**
 * Create a new vendor service
 */
export const createVendorService = asyncHandler(async (req: Request, res: Response) => {
    const vendorId = req.vendorId;
    const { name, description, categoryId, subCategoryId, serviceId, price, duration } = req.body;

    // Find or create a default service if not provided
    let actualServiceId = serviceId;
    if (!actualServiceId) {
        // Find first service in this category or create one
        let service = await Service.findOne({ categoryId });
        if (!service) {
            service = await Service.create({
                name: name,
                categoryId,
                subCategoryId: subCategoryId || categoryId,
                isActive: true
            });
        }
        actualServiceId = service._id;
    }

    // Get default subCategoryId if not provided
    let actualSubCategoryId = subCategoryId;
    if (!actualSubCategoryId) {
        const subCat = await SubCategory.findOne({ categoryId });
        actualSubCategoryId = subCat?._id || categoryId;
    }

    const vendorService = await VendorService.create({
        vendorId,
        name,
        subTitle: name,
        description: [{
            title: 'Description',
            type: 'text',
            content: [description || '']
        }],
        shortDescriptionType: 'text',
        shortDescription: [description || name],
        categoryId,
        subCategoryId: actualSubCategoryId,
        serviceId: actualServiceId,
        price: Number(price),
        duration: Number(duration),
        isActive: true
    });

    res.status(201).json({
        success: true,
        message: 'Service created successfully',
        data: {
            id: vendorService._id,
            name: vendorService.name,
            price: vendorService.price,
            duration: vendorService.duration
        }
    });
});

/**
 * Update a vendor service
 */
export const updateVendorService = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const vendorId = req.vendorId;
    const updates = req.body;

    const service = await VendorService.findOne({ _id: id, vendorId });

    if (!service) {
        throw new AppError('Service not found', 404);
    }

    // Update allowed fields
    if (updates.name) service.name = updates.name;
    if (updates.description) {
        service.description = [{
            title: 'Description',
            type: 'text',
            content: [updates.description]
        }];
        service.shortDescription = [updates.description];
    }
    if (updates.price) service.price = Number(updates.price);
    if (updates.duration) service.duration = Number(updates.duration);
    if (updates.categoryId) service.categoryId = updates.categoryId;
    if (typeof updates.isActive === 'boolean') service.isActive = updates.isActive;

    await service.save();

    res.status(200).json({
        success: true,
        message: 'Service updated successfully'
    });
});

/**
 * Delete a vendor service
 */
export const deleteVendorService = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const vendorId = req.vendorId;

    const service = await VendorService.findOne({ _id: id, vendorId });

    if (!service) {
        throw new AppError('Service not found', 404);
    }

    // Check if service has upcoming appointments
    const hasAppointments = await Appointment.exists({
        vendorServiceId: id,
        status: { $in: ['pending', 'confirmed'] },
        appointmentDate: { $gte: new Date() }
    });

    if (hasAppointments) {
        throw new AppError('Cannot delete service with upcoming appointments', 400);
    }

    // Delete associated slots
    await VendorServiceSlot.deleteMany({ vendorServiceId: id });

    // Delete the service
    await VendorService.findByIdAndDelete(id);

    res.status(200).json({
        success: true,
        message: 'Service deleted successfully'
    });
});

/**
 * Get slots for a vendor service
 */
export const getServiceSlots = asyncHandler(async (req: Request, res: Response) => {
    const { serviceId } = req.params;
    const vendorId = req.vendorId;
    const { month, year } = req.query;

    // Verify service belongs to vendor
    const service = await VendorService.findOne({ _id: serviceId, vendorId });
    if (!service) {
        throw new AppError('Service not found', 404);
    }

    const query: any = { vendorServiceId: serviceId };
    if (month && year) {
        query.month = Number(month);
        query.year = Number(year);
    }

    const slotDocs = await VendorServiceSlot.find(query)
        .sort({ year: 1 })
        .lean();

    // Flatten the nested structure for easier frontend consumption
    const slots: any[] = [];
    for (const doc of slotDocs) {
        for (const dateEntry of doc.dates || []) {
            for (const timing of dateEntry.timings || []) {
                slots.push({
                    _id: `${doc._id}-${dateEntry.date}-${timing.fromTime}`,
                    slotDocId: doc._id,
                    date: dateEntry.date,
                    fromTime: timing.fromTime,
                    toTime: timing.toTime,
                    reoccurrence: timing.reoccurrence || dateEntry.reoccurrence || 1
                });
            }
        }
    }

    res.status(200).json({
        success: true,
        data: slots
    });
});

/**
 * Create a slot for a vendor service
 */
export const createServiceSlot = asyncHandler(async (req: Request, res: Response) => {
    const { serviceId } = req.params;
    const vendorId = req.vendorId;
    const { date, fromTime, toTime, reoccurrence = 1 } = req.body;

    // Verify service belongs to vendor
    const service = await VendorService.findOne({ _id: serviceId, vendorId });
    if (!service) {
        throw new AppError('Service not found', 404);
    }

    const slotDate = new Date(date);
    const month = slotDate.getMonth() + 1; // 1-12
    const year = slotDate.getFullYear();

    // Find existing slot document for this month/year or create new one
    let slotDoc = await VendorServiceSlot.findOne({
        vendorServiceId: serviceId,
        month,
        year
    });

    const newTiming = {
        fromTime,
        toTime,
        reoccurrence: Number(reoccurrence)
    };

    const newDateEntry = {
        date: slotDate,
        reoccurrence: Number(reoccurrence),
        timingType: 'custom',
        timings: [newTiming]
    };

    if (slotDoc) {
        // Check if date already exists
        const existingDateIdx = slotDoc.dates.findIndex(
            (d: any) => new Date(d.date).toDateString() === slotDate.toDateString()
        );

        if (existingDateIdx >= 0) {
            // Add timing to existing date
            (slotDoc.dates[existingDateIdx] as any).timings.push(newTiming);
        } else {
            // Add new date entry
            slotDoc.dates.push(newDateEntry as any);
        }
        await slotDoc.save();
    } else {
        // Create new slot document
        slotDoc = await VendorServiceSlot.create({
            vendorServiceId: serviceId,
            month,
            year,
            reoccurrence: Number(reoccurrence),
            dates: [newDateEntry]
        });
    }

    res.status(201).json({
        success: true,
        message: 'Slot created successfully',
        data: {
            _id: slotDoc._id,
            date: slotDate,
            fromTime,
            toTime,
            reoccurrence: Number(reoccurrence)
        }
    });
});

/**
 * Update a slot
 */
export const updateServiceSlot = asyncHandler(async (req: Request, res: Response) => {
    const { serviceId, slotId } = req.params;
    const vendorId = req.vendorId;
    const { date, fromTime, toTime, oldFromTime, reoccurrence } = req.body;

    // Verify service belongs to vendor
    const service = await VendorService.findOne({ _id: serviceId, vendorId });
    if (!service) {
        throw new AppError('Service not found', 404);
    }

    // slotId is the document ID, we need to find the specific timing within it
    const slotDoc = await VendorServiceSlot.findOne({ _id: slotId, vendorServiceId: serviceId });
    if (!slotDoc) {
        throw new AppError('Slot not found', 404);
    }

    // Find the date entry and timing to update
    const targetDate = new Date(date);
    const dateEntryIdx = slotDoc.dates.findIndex(
        (d: any) => new Date(d.date).toDateString() === targetDate.toDateString()
    );

    if (dateEntryIdx === -1) {
        throw new AppError('Date entry not found in slot', 404);
    }

    const dateEntry = slotDoc.dates[dateEntryIdx] as any;
    const timingIdx = dateEntry.timings.findIndex(
        (t: any) => t.fromTime === (oldFromTime || fromTime)
    );

    if (timingIdx === -1) {
        throw new AppError('Timing not found', 404);
    }

    // Update the timing
    if (fromTime) dateEntry.timings[timingIdx].fromTime = fromTime;
    if (toTime) dateEntry.timings[timingIdx].toTime = toTime;
    if (reoccurrence) dateEntry.timings[timingIdx].reoccurrence = Number(reoccurrence);

    await slotDoc.save();

    res.status(200).json({
        success: true,
        message: 'Slot updated successfully'
    });
});

/**
 * Delete a slot
 */
export const deleteServiceSlot = asyncHandler(async (req: Request, res: Response) => {
    const { serviceId, slotId } = req.params;
    const vendorId = req.vendorId;
    const { date, fromTime } = req.body;

    // Verify service belongs to vendor
    const service = await VendorService.findOne({ _id: serviceId, vendorId });
    if (!service) {
        throw new AppError('Service not found', 404);
    }

    const slotDoc = await VendorServiceSlot.findOne({ _id: slotId, vendorServiceId: serviceId });
    if (!slotDoc) {
        throw new AppError('Slot not found', 404);
    }

    if (date && fromTime) {
        // Delete specific timing from specific date
        const targetDate = new Date(date);
        const dateEntryIdx = slotDoc.dates.findIndex(
            (d: any) => new Date(d.date).toDateString() === targetDate.toDateString()
        );

        if (dateEntryIdx >= 0) {
            const dateEntry = slotDoc.dates[dateEntryIdx] as any;
            dateEntry.timings = dateEntry.timings.filter((t: any) => t.fromTime !== fromTime);

            // If no more timings for this date, remove the date entry
            if (dateEntry.timings.length === 0) {
                slotDoc.dates.splice(dateEntryIdx, 1);
            }

            // If no more dates, delete the entire document
            if ((slotDoc.dates as any[]).length === 0) {
                await VendorServiceSlot.findByIdAndDelete(slotId);
            } else {
                await slotDoc.save();
            }
        }
    } else {
        // Delete entire slot document
        await VendorServiceSlot.findByIdAndDelete(slotId);
    }

    res.status(200).json({
        success: true,
        message: 'Slot deleted successfully'
    });
});
