import express from 'express';
import { createVendorServiceSlot, getVendorServiceSlots, getVendorServiceSlotById, updateVendorServiceSlot, deleteVendorServiceSlot } from '../../controllers/vendor-service-slot.controller';


const router = express.Router();

//router.post('/', protect, authorize('admin'), vendorServiceValidationRules.create(), createVendorService);
router.post('/', createVendorServiceSlot);
router.get('/', getVendorServiceSlots);
router.get('/:id', getVendorServiceSlotById);
//router.put('/:id', protect, authorize('admin'), vendorServiceValidationRules.update(), updateVendorService);
router.put('/:id', updateVendorServiceSlot);
router.delete('/:id', deleteVendorServiceSlot);

export default router;