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
    getVerificationStats
} from '../../controllers/vendor.controller';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(protectAdmin);

// Verification routes (must be before /:id routes)
router.get('/verification/list', getVendorsByVerificationStatus);
router.get('/verification/stats', getVerificationStats);
router.put('/verification/:id', verifyVendor);

// Standard CRUD routes
router.post('/', createVendor);
router.get('/', getVendors);
router.get('/:id', getVendorById);
router.put('/:id', updateVendor);
router.delete('/:id', deleteVendor);

export default router;
