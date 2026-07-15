import express from 'express';
import { protectAdmin } from '../../middlewares/admin-auth.middleware';
import {
  createVendor,
  getVendors,
  getVendorById,
  updateVendor,
  deleteVendor,
  getVendorsByVerificationStatus,
  verifyVendor,
  getVerificationStats,
} from '../../controllers/vendor.controller';
import {
  adminListVendorDocuments,
  adminReviewVendorDocument,
} from '../../controllers/vendor-documents.controller';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(protectAdmin);

// Verification routes (must be before /:id routes)
router.get('/verification/list', getVendorsByVerificationStatus);
router.get('/verification/stats', getVerificationStats);
router.put('/verification/:id', verifyVendor);

// Business documents review (license, insurance, W-9)
router.get('/:id/documents', adminListVendorDocuments);
router.patch('/:id/documents/:docId', adminReviewVendorDocument);

// Standard CRUD routes
router.post('/', createVendor);
router.get('/', getVendors);
router.get('/:id', getVendorById);
router.put('/:id', updateVendor);
router.delete('/:id', deleteVendor);

export default router;
