import express from 'express';
import { protect, authorize } from './../../middlewares/auth.middleware';
import { createVendorService, getVendorServices, getVendorServiceById, updateVendorService, deleteVendorService } from './../../controllers/vendor-service.controller';

const router = express.Router();

// All admin routes require authentication and admin role
router.post('/', protect, authorize('admin'), createVendorService);
router.get('/', protect, authorize('admin'), getVendorServices);
router.get('/:id', protect, authorize('admin'), getVendorServiceById);
router.put('/:id', protect, authorize('admin'), updateVendorService);
router.delete('/:id', protect, authorize('admin'), deleteVendorService);

export default router;
