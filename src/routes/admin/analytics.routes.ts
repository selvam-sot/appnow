import express from 'express';
import { protect, authorize } from '../../middlewares/auth.middleware';
import {
    getRevenueAnalytics,
    getUserAnalytics,
    getAppointmentAnalytics
} from '../../controllers/analytics.controller';

const router = express.Router();

// All analytics routes require admin authentication
router.use(protect, authorize('admin'));

/**
 * @swagger
 * /api/admin/analytics/revenue:
 *   get:
 *     summary: Get revenue analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for the analytics period
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for the analytics period
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *         description: Group results by time period
 *     responses:
 *       200:
 *         description: Revenue analytics data
 */
router.get('/revenue', getRevenueAnalytics);

/**
 * @swagger
 * /api/admin/analytics/users:
 *   get:
 *     summary: Get user analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *     responses:
 *       200:
 *         description: User analytics data
 */
router.get('/users', getUserAnalytics);

/**
 * @swagger
 * /api/admin/analytics/appointments:
 *   get:
 *     summary: Get appointment analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *     responses:
 *       200:
 *         description: Appointment analytics data
 */
router.get('/appointments', getAppointmentAnalytics);

export default router;
