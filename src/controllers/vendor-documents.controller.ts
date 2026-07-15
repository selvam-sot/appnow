import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.util';
import { AppError } from '../utils/appError.util';
import Vendor from '../models/vendor.model';
import { logAuditEvent } from '../middlewares/audit.middleware';

/**
 * Vendor compliance documents (license, insurance, W-9, etc.).
 *
 * The client uploads the file to whatever storage the app uses (Clerk,
 * Cloudinary, S3) and posts the resulting URL here. Admin reviews and
 * transitions status. Kept separate from Stripe Connect KYC because
 * Stripe's KYC covers identity + bank account but not state-level
 * professional licensing, business insurance, or W-9 collection.
 */

const ALLOWED_DOC_TYPES = [
  'business_license',
  'insurance_certificate',
  'w9_form',
  'professional_license',
  'other',
];

/** POST /vendor/documents — vendor uploads a document URL */
export const uploadVendorDocument = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = (req as any).vendorId;
  if (!vendorId) throw new AppError('Vendor session required', 401);

  const { docType, url } = req.body as { docType?: string; url?: string };
  if (!docType || !ALLOWED_DOC_TYPES.includes(docType)) {
    throw new AppError(
      `docType must be one of: ${ALLOWED_DOC_TYPES.join(', ')}`,
      400,
    );
  }
  if (!url || typeof url !== 'string' || url.length < 5) {
    throw new AppError('Valid document URL is required', 400);
  }

  const vendor = await Vendor.findById(vendorId);
  if (!vendor) throw new AppError('Vendor not found', 404);

  (vendor as any).businessDocuments = (vendor as any).businessDocuments || [];
  (vendor as any).businessDocuments.push({
    docType,
    url,
    status: 'pending_review',
    uploadedAt: new Date(),
  });
  await vendor.save();

  res.status(201).json({
    success: true,
    data: (vendor as any).businessDocuments,
  });
});

/** GET /vendor/documents — vendor sees their own documents */
export const listVendorDocuments = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = (req as any).vendorId;
  if (!vendorId) throw new AppError('Vendor session required', 401);

  const vendor = await Vendor.findById(vendorId).select('businessDocuments');
  res.status(200).json({
    success: true,
    data: (vendor as any)?.businessDocuments || [],
  });
});

/** DELETE /vendor/documents/:docId — vendor removes a not-yet-approved doc */
export const removeVendorDocument = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = (req as any).vendorId;
  if (!vendorId) throw new AppError('Vendor session required', 401);
  const { docId } = req.params;

  const vendor = await Vendor.findById(vendorId);
  if (!vendor) throw new AppError('Vendor not found', 404);

  const docs = (vendor as any).businessDocuments || [];
  const target = docs.find((d: any) => d._id?.toString() === docId);
  if (!target) throw new AppError('Document not found', 404);
  if (target.status === 'approved') {
    throw new AppError('Cannot remove an approved document — contact support', 400);
  }

  (vendor as any).businessDocuments = docs.filter(
    (d: any) => d._id?.toString() !== docId,
  );
  await vendor.save();

  res.status(200).json({ success: true, data: (vendor as any).businessDocuments });
});

/** GET /admin/vendors/:id/documents — admin sees any vendor's documents */
export const adminListVendorDocuments = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const vendor = await Vendor.findById(id).select('businessDocuments vendorName');
  if (!vendor) throw new AppError('Vendor not found', 404);
  res.status(200).json({
    success: true,
    data: {
      vendorId: vendor._id,
      vendorName: (vendor as any).vendorName,
      documents: (vendor as any).businessDocuments || [],
    },
  });
});

/** PATCH /admin/vendors/:id/documents/:docId — approve or reject a document */
export const adminReviewVendorDocument = asyncHandler(async (req: Request, res: Response) => {
  const admin = (req as any).user;
  if (!admin?._id) throw new AppError('Admin session required', 401);
  const { id, docId } = req.params;
  const { status, notes } = req.body as { status?: string; notes?: string };

  if (!status || !['approved', 'rejected'].includes(status)) {
    throw new AppError('status must be "approved" or "rejected"', 400);
  }
  if (status === 'rejected' && (!notes || notes.trim().length < 5)) {
    throw new AppError('Rejection requires notes of at least 5 characters', 400);
  }

  const vendor = await Vendor.findById(id);
  if (!vendor) throw new AppError('Vendor not found', 404);

  const doc = ((vendor as any).businessDocuments || []).find(
    (d: any) => d._id?.toString() === docId,
  );
  if (!doc) throw new AppError('Document not found', 404);

  doc.status = status;
  doc.reviewNotes = notes?.trim();
  doc.reviewedAt = new Date();
  doc.reviewedBy = admin._id;
  await vendor.save();

  await logAuditEvent('DOCUMENT_REVIEW', 'vendor', {
    userId: String(admin._id),
    userEmail: admin.email,
    resourceId: String(vendor._id),
    metadata: {
      docId,
      docType: doc.docType,
      newStatus: status,
      notes: notes?.trim(),
    },
  });

  res.status(200).json({ success: true, data: doc });
});
