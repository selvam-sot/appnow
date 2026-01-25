import express from 'express';
import { protectAdmin } from '../../middlewares/admin-auth.middleware';
import { createVendorServiceSlot, getVendorServiceSlots, getVendorServiceSlotById, updateVendorServiceSlot, deleteVendorServiceSlot } from '../../controllers/vendor-service-slot.controller';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(protectAdmin);

router.post('/', createVendorServiceSlot);
router.get('/', getVendorServiceSlots);
router.get('/:id', getVendorServiceSlotById);
router.put('/:id', updateVendorServiceSlot);
router.delete('/:id', deleteVendorServiceSlot);

export default router;
