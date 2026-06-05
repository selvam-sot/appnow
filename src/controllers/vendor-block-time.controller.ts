import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.util';
import { AppError } from '../utils/appError.util';
import VendorBlockTime from '../models/vendor-block-time.model';
import Appointment from '../models/appointment.model';
import VendorService from '../models/vendor-service.model';
import { getVendorServiceIds } from '../utils/vendor.util';

/** GET /api/v1/vendor/block-times?from=YYYY-MM-DD&to=YYYY-MM-DD */
export const listBlockTimes = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = req.vendorId!;
  const { from, to } = req.query;

  const filter: any = { vendorId };
  if (from || to) {
    filter.$and = [];
    if (from) filter.$and.push({ toDate: { $gte: new Date(from as string) } });
    if (to) filter.$and.push({ fromDate: { $lte: new Date(to as string) } });
  }

  const blocks = await VendorBlockTime.find(filter).sort({ fromDate: 1 }).lean();
  res.status(200).json({ success: true, data: blocks });
});

/** POST /api/v1/vendor/block-times */
export const createBlockTime = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = req.vendorId!;
  const { fromDate, toDate, allDay = true, fromTime, toTime, reason, notes } = req.body;

  if (!fromDate || !toDate) {
    throw new AppError('fromDate and toDate are required', 400);
  }
  if (!allDay && (!fromTime || !toTime)) {
    throw new AppError('fromTime and toTime are required when allDay is false', 400);
  }

  const block = await VendorBlockTime.create({
    vendorId,
    fromDate: new Date(fromDate),
    toDate: new Date(toDate),
    allDay,
    fromTime,
    toTime,
    reason,
    notes,
  });

  res.status(201).json({ success: true, data: block });
});

/** PUT /api/v1/vendor/block-times/:id */
export const updateBlockTime = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = req.vendorId!;
  const updates: any = {};
  const allowed = ['fromDate', 'toDate', 'allDay', 'fromTime', 'toTime', 'reason', 'notes'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  const block = await VendorBlockTime.findOneAndUpdate({ _id: req.params.id, vendorId }, updates, {
    new: true,
  });
  if (!block) throw new AppError('Block-time entry not found', 404);
  res.status(200).json({ success: true, data: block });
});

/** DELETE /api/v1/vendor/block-times/:id */
export const deleteBlockTime = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = req.vendorId!;
  const block = await VendorBlockTime.findOneAndDelete({ _id: req.params.id, vendorId });
  if (!block) throw new AppError('Block-time entry not found', 404);
  res.status(200).json({ success: true, message: 'Block-time removed' });
});

/**
 * GET /api/v1/vendor/customers/:customerId/history
 * Returns this customer's appointment history with the authenticated vendor,
 * for the "repeat customer" indicator + customer profile.
 */
export const getCustomerHistoryForVendor = asyncHandler(
  async (req: Request, res: Response) => {
    const vendorId = req.vendorId!;
    const { customerId } = req.params;

    const serviceIds = await getVendorServiceIds(vendorId);

    const [appointments, totalSpend] = await Promise.all([
      Appointment.find({
        customerId,
        vendorServiceId: { $in: serviceIds },
      })
        .populate({
          path: 'vendorServiceId',
          select: 'name',
          populate: { path: 'serviceId', select: 'name' },
        })
        .sort({ appointmentDate: -1 })
        .limit(50)
        .lean(),
      Appointment.aggregate([
        {
          $match: {
            customerId: appointments_match_customer(customerId),
            vendorServiceId: { $in: vendorServiceIdsAsObjectIds(serviceIds) },
            status: 'completed',
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$total' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalAppointments: appointments.length,
        totalCompleted: totalSpend[0]?.count || 0,
        totalSpent: totalSpend[0]?.total || 0,
        appointments: appointments.map((a: any) => ({
          _id: a._id,
          appointmentDate: a.appointmentDate,
          startTime: a.startTime,
          endTime: a.endTime,
          status: a.status,
          total: a.total,
          tipAmount: a.tipAmount || 0,
          customerNotes: a.customerNotes,
          serviceName: a.vendorServiceId?.serviceId?.name || a.vendorServiceId?.name || 'Service',
        })),
      },
    });
  },
);

// ─── Helpers ───
function appointments_match_customer(customerId: string) {
  const mongoose = require('mongoose');
  return new mongoose.Types.ObjectId(customerId);
}

function vendorServiceIdsAsObjectIds(ids: string[]) {
  const mongoose = require('mongoose');
  return ids.map((id) => new mongoose.Types.ObjectId(id));
}
