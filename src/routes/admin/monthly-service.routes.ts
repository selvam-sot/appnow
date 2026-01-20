import express from 'express';
import { protect, authorize } from './../../middlewares/auth.middleware';
import { getMonthlyServices, getMonthlyServiceById, deleteMonthlyService } from './../../controllers/monthly-service.controller';

const router = express.Router();

// All admin routes require authentication and admin role
// Note: Create and Update are not implemented yet (read-only for now)
router.get('/', protect, authorize('admin'), getMonthlyServices);
router.get('/:id', protect, authorize('admin'), getMonthlyServiceById);
router.delete('/:id', protect, authorize('admin'), deleteMonthlyService);

export default router;
