import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.util';
import { AppError } from '../utils/appError.util';
import Appointment from '../models/appointment.model';
import VendorPayout from '../models/vendor-payout.model';

/**
 * Tax + payout reports for compliance.
 *
 *  - Sales tax by state → for state remittance filings.
 *  - 1099-NEC by vendor by year → for IRS 1099 issuance ($600+ threshold).
 *
 * Both endpoints support `?format=csv` for a direct download.
 */

const toCsv = (rows: Record<string, any>[], columns: string[]): string => {
  const escape = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const header = columns.join(',');
  const body = rows.map((r) => columns.map((c) => escape(r[c])).join(',')).join('\n');
  return `${header}\n${body}\n`;
};

const parseDateRange = (req: Request) => {
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const start = req.query.startDate
    ? new Date(String(req.query.startDate))
    : defaultStart;
  const end = req.query.endDate ? new Date(String(req.query.endDate)) : now;
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

/**
 * GET /admin/reports/sales-tax-by-state?startDate=&endDate=&format=json|csv
 * Aggregates tax collected per US state (from customerAddress.state on
 * completed/confirmed appointments). Format defaults to json.
 */
export const salesTaxByState = asyncHandler(async (req: Request, res: Response) => {
  const { start, end } = parseDateRange(req);

  const results = await Appointment.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
        paymentStatus: { $in: ['completed', 'partially_refunded'] },
        taxAmount: { $gt: 0 },
      },
    },
    {
      $group: {
        _id: {
          $ifNull: ['$customerAddress.state', 'unknown'],
        },
        appointments: { $sum: 1 },
        totalSales: { $sum: '$serviceFee' },
        totalTax: { $sum: '$taxAmount' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const rows = results.map((r: any) => ({
    state: r._id || 'unknown',
    appointments: r.appointments,
    totalSales: Number((r.totalSales || 0).toFixed(2)),
    totalTax: Number((r.totalTax || 0).toFixed(2)),
  }));

  const totals = rows.reduce(
    (acc, r) => ({
      appointments: acc.appointments + r.appointments,
      totalSales: acc.totalSales + r.totalSales,
      totalTax: acc.totalTax + r.totalTax,
    }),
    { appointments: 0, totalSales: 0, totalTax: 0 },
  );
  totals.totalSales = Number(totals.totalSales.toFixed(2));
  totals.totalTax = Number(totals.totalTax.toFixed(2));

  if (req.query.format === 'csv') {
    const csv = toCsv(
      [...rows, { state: 'TOTAL', ...totals }],
      ['state', 'appointments', 'totalSales', 'totalTax'],
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="sales-tax-${start.toISOString().slice(0, 10)}_${end.toISOString().slice(0, 10)}.csv"`,
    );
    res.send(csv);
    return;
  }

  res.status(200).json({
    success: true,
    data: {
      dateRange: { start, end },
      rows,
      totals,
    },
  });
});

/**
 * GET /admin/reports/1099/:year?format=json|csv
 * Aggregates each vendor's yearly earnings (paid payouts). Vendors who
 * received ≥ $600 in the calendar year require a 1099-NEC per IRS rules.
 */
export const nineteen99Report = asyncHandler(async (req: Request, res: Response) => {
  const year = parseInt(req.params.year, 10);
  if (!year || year < 2020 || year > 2100) {
    throw new AppError('Invalid year', 400);
  }
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);

  const results = await VendorPayout.aggregate([
    {
      $match: {
        status: 'paid',
        createdAt: { $gte: start, $lt: end },
      },
    },
    {
      $group: {
        _id: '$vendorId',
        totalPaid: { $sum: '$netAmount' },
        totalGross: { $sum: '$grossAmount' },
        totalFees: { $sum: '$feeAmount' },
        payouts: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: 'vendors',
        localField: '_id',
        foreignField: '_id',
        as: 'vendor',
      },
    },
    { $unwind: { path: '$vendor', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        vendorId: '$_id',
        vendorName: { $ifNull: ['$vendor.vendorName', '$vendor.serviceProviderName'] },
        email: '$vendor.email',
        taxId: '$vendor.taxId',
        state: '$vendor.state',
        payouts: 1,
        totalPaid: 1,
        totalGross: 1,
        totalFees: 1,
        requires1099: { $gte: ['$totalPaid', 600] },
      },
    },
    { $sort: { totalPaid: -1 } },
  ]);

  const rows = results.map((r: any) => ({
    vendorId: String(r.vendorId),
    vendorName: r.vendorName || 'Unknown',
    email: r.email || '',
    taxId: r.taxId || '',
    state: r.state || '',
    payouts: r.payouts,
    totalGross: Number((r.totalGross || 0).toFixed(2)),
    totalFees: Number((r.totalFees || 0).toFixed(2)),
    totalPaid: Number((r.totalPaid || 0).toFixed(2)),
    requires1099: r.requires1099 ? 'YES' : 'no',
  }));

  const eligibleCount = rows.filter((r) => r.requires1099 === 'YES').length;

  if (req.query.format === 'csv') {
    const csv = toCsv(rows, [
      'vendorId',
      'vendorName',
      'email',
      'taxId',
      'state',
      'payouts',
      'totalGross',
      'totalFees',
      'totalPaid',
      'requires1099',
    ]);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="1099-${year}.csv"`);
    res.send(csv);
    return;
  }

  res.status(200).json({
    success: true,
    data: {
      year,
      totalVendors: rows.length,
      requiring1099: eligibleCount,
      rows,
    },
  });
});

/**
 * GET /admin/reports/revenue.csv?startDate=&endDate=
 * Simple CSV dump of every completed appointment in the range. Complements
 * the existing generateRevenueReport (which returns an aggregate JSON).
 */
export const revenueLedgerCsv = asyncHandler(async (req: Request, res: Response) => {
  const { start, end } = parseDateRange(req);
  const items = await Appointment.find({
    createdAt: { $gte: start, $lte: end },
    paymentStatus: { $in: ['completed', 'partially_refunded', 'refunded'] },
  })
    .populate('vendorServiceId', 'name')
    .populate('customerId', 'email name')
    .select(
      'appointmentDate startTime serviceFee tipAmount taxAmount total paymentStatus paymentMode createdAt customerAddress',
    )
    .lean();

  const rows = items.map((a: any) => ({
    appointmentId: String(a._id),
    createdAt: a.createdAt?.toISOString().slice(0, 10),
    appointmentDate: a.appointmentDate
      ? new Date(a.appointmentDate).toISOString().slice(0, 10)
      : '',
    startTime: a.startTime,
    customer: a.customerId?.email || '',
    service: a.vendorServiceId?.name || '',
    state: a.customerAddress?.state || '',
    serviceFee: Number((a.serviceFee || 0).toFixed(2)),
    tipAmount: Number((a.tipAmount || 0).toFixed(2)),
    taxAmount: Number((a.taxAmount || 0).toFixed(2)),
    total: Number((a.total || 0).toFixed(2)),
    paymentStatus: a.paymentStatus,
    paymentMode: a.paymentMode,
  }));

  const csv = toCsv(rows, [
    'appointmentId',
    'createdAt',
    'appointmentDate',
    'startTime',
    'customer',
    'service',
    'state',
    'serviceFee',
    'tipAmount',
    'taxAmount',
    'total',
    'paymentStatus',
    'paymentMode',
  ]);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="revenue-ledger-${start.toISOString().slice(0, 10)}_${end.toISOString().slice(0, 10)}.csv"`,
  );
  res.send(csv);
});
