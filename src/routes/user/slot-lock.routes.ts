import express from 'express';
import { body, query } from 'express-validator';
import {
    lockSlot,
    unlockSlot,
    checkSlotLock,
    getUserLocks,
    releaseUserLocks
} from '../../controllers/slot-lock.controller';
import { paymentLimiter } from '../../middlewares/rateLimiter.middleware';

const router = express.Router();

// Apply rate limiting to lock operations
router.use(paymentLimiter);

/**
 * @swagger
 * /api/v1/customer/slot-locks/lock:
 *   post:
 *     summary: Lock a slot for payment processing
 *     description: Temporarily locks a slot while the user completes payment. Lock expires after 10 minutes.
 *     tags: [Slot Locks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - vendorServiceId
 *               - date
 *               - fromTime
 *               - toTime
 *             properties:
 *               vendorServiceId:
 *                 type: string
 *                 description: The vendor service ID
 *               date:
 *                 type: string
 *                 format: date
 *                 description: The appointment date
 *               fromTime:
 *                 type: string
 *                 example: "10:00"
 *               toTime:
 *                 type: string
 *                 example: "11:00"
 *               paymentIntentId:
 *                 type: string
 *                 description: Optional Stripe payment intent ID
 *     responses:
 *       201:
 *         description: Slot locked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/SlotLock'
 *       409:
 *         description: Slot is already locked or booked
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 */
router.post('/lock', [
    body('vendorServiceId').notEmpty().withMessage('Vendor service ID is required'),
    body('date').notEmpty().isISO8601().withMessage('Valid date is required'),
    body('fromTime').notEmpty().withMessage('From time is required'),
    body('toTime').notEmpty().withMessage('To time is required'),
    body('paymentIntentId').optional().isString()
], lockSlot);

/**
 * @swagger
 * /api/v1/customer/slot-locks/unlock:
 *   post:
 *     summary: Unlock a slot (release the lock)
 *     description: Release a previously locked slot. Can unlock by paymentIntentId or by slot details.
 *     tags: [Slot Locks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paymentIntentId:
 *                 type: string
 *               vendorServiceId:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date
 *               fromTime:
 *                 type: string
 *               toTime:
 *                 type: string
 *     responses:
 *       200:
 *         description: Slot unlocked successfully
 *       404:
 *         description: No lock found to release
 */
router.post('/unlock', [
    body('paymentIntentId').optional().isString(),
    body('vendorServiceId').optional().isMongoId(),
    body('date').optional().isISO8601(),
    body('fromTime').optional().isString(),
    body('toTime').optional().isString()
], unlockSlot);

/**
 * @swagger
 * /api/v1/customer/slot-locks/check:
 *   get:
 *     summary: Check if a slot is locked or available
 *     tags: [Slot Locks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: vendorServiceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: fromTime
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: toTime
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Slot availability status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 available:
 *                   type: boolean
 *                 locked:
 *                   type: boolean
 *                 isOwnLock:
 *                   type: boolean
 *                 lockedUntil:
 *                   type: string
 *                   format: date-time
 *                 message:
 *                   type: string
 */
router.get('/check', [
    query('vendorServiceId').notEmpty().withMessage('Vendor service ID is required'),
    query('date').notEmpty().isISO8601().withMessage('Valid date is required'),
    query('fromTime').notEmpty().withMessage('From time is required'),
    query('toTime').notEmpty().withMessage('To time is required')
], checkSlotLock);

/**
 * @swagger
 * /api/v1/customer/slot-locks/my-locks:
 *   get:
 *     summary: Get user's active locks
 *     tags: [Slot Locks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's active locks
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SlotLock'
 *   delete:
 *     summary: Release all user's locks
 *     tags: [Slot Locks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All locks released
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 deletedCount:
 *                   type: number
 */
router.get('/my-locks', getUserLocks);
router.delete('/my-locks', releaseUserLocks);

export default router;
