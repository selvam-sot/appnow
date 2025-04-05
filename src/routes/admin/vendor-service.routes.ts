import express from 'express';
import { createVendorService, getVendorServices, getVendorServiceById, updateVendorService, deleteVendorService } from './../../controllers/vendor-service.controller';

const router = express.Router();

//router.post('/', protect, authorize('admin'), vendorServiceValidationRules.create(), createVendorService);
router.post('/', createVendorService);
router.get('/', getVendorServices);
router.get('/:id', getVendorServiceById);
//router.put('/:id', protect, authorize('admin'), vendorServiceValidationRules.update(), updateVendorService);
router.put('/:id', updateVendorService);
router.delete('/:id', deleteVendorService);

export default router;