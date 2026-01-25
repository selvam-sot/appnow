import express from 'express';
import { body } from 'express-validator';
import {
    signupUser,
    loginUser,
    activateUser,
    logoutUser,
    getUserProfile,
    updateUserProfile,
    deleteUserAccount,
    getUsers,
    searchUsers,
    getUserById,
    updateUserById,
    deactivateUser,
    reactivateUser,
    deleteUserById,
    bulkDeactivateUsers,
    bulkActivateUsers,
    resetUserPassword
} from '../../controllers/user.controller';
import { protectAdmin } from '../../middlewares/admin-auth.middleware';
import { userValidationRules } from '../../utils/validation.util';
import { authLimiter, registrationLimiter } from '../../middlewares/rateLimiter.middleware';

const router = express.Router();

// Public routes (legacy local auth - kept for backwards compatibility)
router.post('/signup', registrationLimiter, userValidationRules.create(), signupUser);
router.post('/login', authLimiter, userValidationRules.login(), loginUser);
router.get('/activate/:activationToken', activateUser);

// Protected routes (require admin authentication via Clerk)
router.post('/logout', protectAdmin, logoutUser);
router.get('/profile', protectAdmin, getUserProfile);
router.put('/profile', protectAdmin, userValidationRules.update(), updateUserProfile);

// Admin-only routes
router.delete('/account', protectAdmin, deleteUserAccount);
router.get('/', protectAdmin, getUsers);

/**
 * @swagger
 * /api/admin/users/search:
 *   get:
 *     summary: Search and filter users with pagination
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, customer, vendor]
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: authProvider
 *         schema:
 *           type: string
 *           enum: [local, clerk]
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: Paginated user list
 */
router.get('/search', protectAdmin, searchUsers);

/**
 * @swagger
 * /api/admin/users/bulk/deactivate:
 *   post:
 *     summary: Bulk deactivate users
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Users deactivated
 */
router.post('/bulk/deactivate', protectAdmin, [
    body('userIds').isArray().withMessage('userIds must be an array')
], bulkDeactivateUsers);

/**
 * @swagger
 * /api/admin/users/bulk/activate:
 *   post:
 *     summary: Bulk activate users
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 */
router.post('/bulk/activate', protectAdmin, [
    body('userIds').isArray().withMessage('userIds must be an array')
], bulkActivateUsers);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', protectAdmin, getUserById);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   put:
 *     summary: Update user by ID
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', protectAdmin, updateUserById);

/**
 * @swagger
 * /api/admin/users/{id}/deactivate:
 *   post:
 *     summary: Deactivate user
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/deactivate', protectAdmin, deactivateUser);

/**
 * @swagger
 * /api/admin/users/{id}/reactivate:
 *   post:
 *     summary: Reactivate user
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/reactivate', protectAdmin, reactivateUser);

/**
 * @swagger
 * /api/admin/users/{id}/reset-password:
 *   post:
 *     summary: Reset user password (admin)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/reset-password', protectAdmin, [
    body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
], resetUserPassword);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   delete:
 *     summary: Delete user by ID
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', protectAdmin, deleteUserById);

export default router;
