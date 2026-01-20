import express from 'express';
import { protect, authorize } from '../../middlewares/auth.middleware';
import { getDashboardStats } from '../../controllers/dashboard.controller';

const router = express.Router();

// Dashboard requires admin authentication
router.get('/stats', protect, authorize('admin'), getDashboardStats);

export default router;
