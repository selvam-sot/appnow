import express from 'express';
import { protectAdmin } from '../../middlewares/admin-auth.middleware';
import { createVendorService, getVendorServices, getVendorServiceById, updateVendorService, deleteVendorService } from '../../controllers/vendor-service.controller';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(protectAdmin);

router.post('/', createVendorService);
router.get('/', getVendorServices);
router.get('/:id', getVendorServiceById);
router.put('/:id', updateVendorService);
router.delete('/:id', deleteVendorService);

export default router;
