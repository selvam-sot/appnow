import express from 'express';
import { protectAdmin } from '../../middlewares/admin-auth.middleware';
import {
    getAuditLogs,
    getAuditLogById,
    getAuditLogStats,
    getUserActivity
} from '../../controllers/audit-log.controller';

const router = express.Router();

// All audit log routes require admin authentication
router.use(protectAdmin);

/**
 * @swagger
 * /api/admin/audit-logs:
 *   get:
 *     summary: Get audit logs with filtering
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 50
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *           enum: [CREATE, READ, UPDATE, DELETE, LOGIN, LOGOUT, EXPORT, IMPORT, OTHER]
 *       - in: query
 *         name: resource
 *         schema:
 *           type: string
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
 *         name: statusCode
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: Paginated audit logs
 */
router.get('/', getAuditLogs);

/**
 * @swagger
 * /api/admin/audit-logs/stats:
 *   get:
 *     summary: Get audit log statistics
 *     tags: [Audit Logs]
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
 *     responses:
 *       200:
 *         description: Audit log statistics
 */
router.get('/stats', getAuditLogStats);

/**
 * @swagger
 * /api/admin/audit-logs/user/{userId}:
 *   get:
 *     summary: Get user activity from audit logs
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User activity logs
 */
router.get('/user/:userId', getUserActivity);

/**
 * @swagger
 * /api/admin/audit-logs/{id}:
 *   get:
 *     summary: Get audit log by ID
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Audit log details
 */
router.get('/:id', getAuditLogById);

export default router;
