import express from 'express';
import { protect, authorize } from './../../middlewares/auth.middleware';
import {
    createVendor,
    getVendors,
    getVendorById,
    updateVendor,
    deleteVendor,
    getVendorsByVerificationStatus,
    verifyVendor,
    getVerificationStats
} from './../../controllers/vendor.controller';

const router = express.Router();

// All admin routes require authentication and admin role

// Verification routes (must be before /:id routes)
router.get('/verification/list', protect, authorize('admin'), getVendorsByVerificationStatus);
router.get('/verification/stats', protect, authorize('admin'), getVerificationStats);
router.put('/verification/:id', protect, authorize('admin'), verifyVendor);

// Standard CRUD routes
router.post('/', protect, authorize('admin'), createVendor);
router.get('/', protect, authorize('admin'), getVendors);
router.get('/:id', protect, authorize('admin'), getVendorById);
router.put('/:id', protect, authorize('admin'), updateVendor);
router.delete('/:id', protect, authorize('admin'), deleteVendor);

export default router;
