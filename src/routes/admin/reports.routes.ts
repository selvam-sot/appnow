import express from 'express';
import { protect, authorize } from '../../middlewares/auth.middleware';
import {
    generateRevenueReport,
    generateUserReport,
    generateAppointmentReport
} from '../../controllers/reports.controller';

const router = express.Router();

// All report routes require admin authentication
router.use(protect, authorize('admin'));

/**
 * @swagger
 * /api/admin/reports/revenue:
 *   get:
 *     summary: Generate revenue report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Report start date (defaults to start of current month)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Report end date (defaults to today)
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *         description: Group data by time period
 *     responses:
 *       200:
 *         description: Revenue report data
 */
router.get('/revenue', generateRevenueReport);

/**
 * @swagger
 * /api/admin/reports/users:
 *   get:
 *     summary: Generate user activity report
 *     tags: [Reports]
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
 *         description: User activity report data
 */
router.get('/users', generateUserReport);

/**
 * @swagger
 * /api/admin/reports/appointments:
 *   get:
 *     summary: Generate appointment summary report
 *     tags: [Reports]
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
 *         description: Appointment report data
 */
router.get('/appointments', generateAppointmentReport);

export default router;
