import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import moment from 'moment';
import { asyncHandler } from '../utils/asyncHandler.util';
import { AppError } from '../utils/appError.util';
import Appointment from '../models/appointment.model';
import logger from '../config/logger';

/**
 * Recurring appointments.
 *
 * Model: each occurrence is its own Appointment (independent payments,
 * cancellations, and notifications). Occurrences share a
 * `recurrenceSeriesId` that lets us query the whole series later.
 *
 * MVP scope:
 *   - Weekly / biweekly / monthly cadences
 *   - Fixed count 2–52 occurrences (no infinite series yet)
 *   - Server checks each generated date for slot collisions before
 *     creating the whole series. If ANY occurrence conflicts, the entire
 *     series creation aborts with a per-date report so the client can
 *     surface which dates need adjustment.
 *   - Payment covers only the first occurrence — subsequent occurrences
 *     are marked `paymentStatus: 'pending'` and expect the customer to
 *     confirm each one 24h before via a reminder (Sprint 8 job).
 */

const advanceDate = (base: Date, frequency: 'weekly' | 'biweekly' | 'monthly', n: number) => {
  const m = moment(base);
  switch (frequency) {
    case 'weekly':
      return m.add(n, 'weeks').toDate();
    case 'biweekly':
      return m.add(n * 2, 'weeks').toDate();
    case 'monthly':
      return m.add(n, 'months').toDate();
  }
};

/**
 * POST /customer/appointments/recurring
 * Body: {
 *   base: <full booking payload for first occurrence, minus recurrence keys>,
 *   recurrence: { frequency: 'weekly'|'biweekly'|'monthly', occurrences: 2..52 }
 * }
 */
export const createRecurringSeries = asyncHandler(async (req: Request, res: Response) => {
  const { base, recurrence } = req.body as {
    base: any;
    recurrence: { frequency: 'weekly' | 'biweekly' | 'monthly'; occurrences: number };
  };

  if (!base?.vendorServiceId || !base?.appointmentDate || !base?.startTime || !base?.endTime) {
    throw new AppError('Base appointment fields are required', 400);
  }
  if (
    !recurrence?.frequency ||
    !['weekly', 'biweekly', 'monthly'].includes(recurrence.frequency)
  ) {
    throw new AppError('recurrence.frequency must be weekly|biweekly|monthly', 400);
  }
  if (
    !recurrence.occurrences ||
    recurrence.occurrences < 2 ||
    recurrence.occurrences > 52
  ) {
    throw new AppError('recurrence.occurrences must be between 2 and 52', 400);
  }

  const seriesId = new mongoose.Types.ObjectId();
  const firstDate = new Date(base.appointmentDate);

  // Pre-generate every occurrence date + check for collisions before writing anything
  const plannedDates: Date[] = [];
  for (let i = 0; i < recurrence.occurrences; i++) {
    plannedDates.push(i === 0 ? firstDate : advanceDate(firstDate, recurrence.frequency, i));
  }

  const collisionQuery: any = {
    vendorServiceId: new mongoose.Types.ObjectId(base.vendorServiceId),
    startTime: base.startTime,
    endTime: base.endTime,
    status: { $nin: ['cancelled', 'rejected'] },
    appointmentDate: { $in: plannedDates },
  };
  if (base.staffId) {
    collisionQuery.$or = [
      { staffId: new mongoose.Types.ObjectId(base.staffId) },
      { staffId: null },
    ];
  }
  const conflicts = await Appointment.find(collisionQuery).select('appointmentDate').lean();

  if (conflicts.length > 0) {
    return res.status(409).json({
      success: false,
      message: 'One or more dates in the series are already booked',
      conflictingDates: conflicts.map((c) => c.appointmentDate),
    });
  }

  // Build the array of appointment docs. Only the first one carries the
  // payment intent (client pre-created it). The rest are payment-pending.
  const docs = plannedDates.map((date, i) => {
    const doc: any = {
      ...base,
      appointmentDate: date,
      recurrenceSeriesId: seriesId,
      status: i === 0 ? base.status || 'confirmed' : 'pending',
    };
    if (i === 0) {
      doc.recurrencePattern = {
        frequency: recurrence.frequency,
        occurrences: recurrence.occurrences,
      };
    } else {
      // Later occurrences: strip the first-instance-only payment fields
      delete doc.paymentIntentId;
      delete doc.stripePaymentIntentId;
      delete doc.idempotencyKey;
      doc.paymentStatus = 'pending';
    }
    return doc;
  });

  const created = await Appointment.insertMany(docs);

  logger.info(
    `[Recurring] Created series ${seriesId} — ${created.length} occurrences (${recurrence.frequency})`,
  );

  res.status(201).json({
    success: true,
    data: {
      seriesId,
      occurrences: created,
      firstAppointmentId: created[0]._id,
      totalOccurrences: created.length,
    },
  });
});

/**
 * DELETE /customer/appointments/recurring/:seriesId
 * Cancels every future occurrence in the series. Past occurrences are
 * left as-is. Body: { reason? }
 */
export const cancelRecurringSeries = asyncHandler(async (req: Request, res: Response) => {
  const { seriesId } = req.params;
  const { reason } = req.body as { reason?: string };
  const now = new Date();

  const result = await Appointment.updateMany(
    {
      recurrenceSeriesId: seriesId,
      appointmentDate: { $gte: now },
      status: { $nin: ['cancelled', 'rejected', 'completed'] },
    },
    {
      $set: {
        status: 'cancelled',
        cancellationReason: reason || 'Series cancelled by customer',
        cancelledAt: now,
      },
    },
  );

  res.status(200).json({
    success: true,
    data: {
      cancelledCount: result.modifiedCount,
      seriesId,
    },
  });
});
