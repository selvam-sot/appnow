import express from 'express';
import { protectAdmin } from '../../middlewares/admin-auth.middleware';
import { getMonthlyServices, getMonthlyServiceById, deleteMonthlyService } from '../../controllers/monthly-service.controller';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(protectAdmin);

// Note: Create and Update are not implemented yet (read-only for now)
router.get('/', getMonthlyServices);
router.get('/:id', getMonthlyServiceById);
router.delete('/:id', deleteMonthlyService);

export default router;
