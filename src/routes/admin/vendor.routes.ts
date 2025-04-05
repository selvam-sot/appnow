import express from 'express';
import { createVendor, getVendors, getVendorById, updateVendor, deleteVendor } from './../../controllers/vendor.controller';

const router = express.Router();

//router.post('/', protect, authorize('admin'), vendorValidationRules.create(), createVendor);
router.post('/', createVendor);
router.get('/', getVendors);
router.get('/:id', getVendorById);
//router.put('/:id', protect, authorize('admin'), vendorValidationRules.update(), updateVendor);
router.put('/:id', updateVendor);
router.delete('/:id', deleteVendor);

export default router;