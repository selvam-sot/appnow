import express from 'express';
import { protect, authorize } from './../../middlewares/auth.middleware';
import { createService, getServices, getServiceById, updateService, deleteService } from './../../controllers/service.controller';

const router = express.Router();

// All admin routes require authentication and admin role
router.post('/', protect, authorize('admin'), createService);
router.get('/', protect, authorize('admin'), getServices);
router.get('/:id', protect, authorize('admin'), getServiceById);
router.put('/:id', protect, authorize('admin'), updateService);
router.delete('/:id', protect, authorize('admin'), deleteService);

export default router;
