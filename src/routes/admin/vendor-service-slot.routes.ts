import express from 'express';
import { protect, authorize } from '../../middlewares/auth.middleware';
import { createVendorServiceSlot, getVendorServiceSlots, getVendorServiceSlotById, updateVendorServiceSlot, deleteVendorServiceSlot } from '../../controllers/vendor-service-slot.controller';

const router = express.Router();

// All admin routes require authentication and admin role
router.post('/', protect, authorize('admin'), createVendorServiceSlot);
router.get('/', protect, authorize('admin'), getVendorServiceSlots);
router.get('/:id', protect, authorize('admin'), getVendorServiceSlotById);
router.put('/:id', protect, authorize('admin'), updateVendorServiceSlot);
router.delete('/:id', protect, authorize('admin'), deleteVendorServiceSlot);

export default router;
