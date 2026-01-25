import express from 'express';
import { protectAdmin } from '../../middlewares/admin-auth.middleware';
import { getDashboardStats, getDashboardCharts } from '../../controllers/dashboard.controller';

const router = express.Router();

// Dashboard requires admin authentication
router.get('/stats', protectAdmin, getDashboardStats);
router.get('/charts', protectAdmin, getDashboardCharts);

export default router;
