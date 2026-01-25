
import express from 'express';
import {
    signupUser,
    loginUser,
    activateUser,
    logoutUser,
    getUserProfile,
    updateUserProfile,
    deleteUserAccount,
    getUsers,
    syncClerkUser,
    getClerkUser,
    updateClerkUser,
    deleteClerkUser
} from '../../controllers/user.controller';
import { registerPushToken, removePushToken } from '../../controllers/notification.controller';
import { protect, authorize } from '../../middlewares/auth.middleware';
import { userValidationRules } from '../../utils/validation.util';
import { authLimiter, registrationLimiter } from '../../middlewares/rateLimiter.middleware';

const router = express.Router();

/**
 * @swagger
 * /api/v1/customer/users/health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: API is healthy
 */
router.get('/health',(req, res) => {
    res.json({
        message: 'User API running in health condition',
        status: 'User routes are working',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        endpoint: '/api/v1/user/health'
    });
});

router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'User routes are working!',
        timestamp: new Date().toISOString()
    });
});

/**
 * @swagger
 * /api/v1/customer/users/signup:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *               phone:
 *                 type: string
 *                 example: "+1234567890"
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Validation error
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 */
router.post('/signup', registrationLimiter, userValidationRules.create(), signupUser);

/**
 * @swagger
 * /api/v1/customer/users/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 token:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Invalid credentials
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 */
router.post('/login', authLimiter, userValidationRules.login(), loginUser);

/**
 * @swagger
 * /api/v1/customer/users/activate/{activationToken}:
 *   get:
 *     summary: Activate user account
 *     tags: [Authentication]
 *     parameters:
 *       - in: path
 *         name: activationToken
 *         required: true
 *         schema:
 *           type: string
 *         description: Account activation token from email
 *     responses:
 *       200:
 *         description: Account activated successfully
 *       400:
 *         description: Invalid or expired token
 */
router.get('/activate/:activationToken', activateUser);

// Protected routes
router.post('/logout', protect, logoutUser);
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, userValidationRules.update(), updateUserProfile);
router.delete('/account', authorize('admin'), deleteUserAccount);

// Admin route to get all users
router.get('/', getUsers);

// ========== CLERK INTEGRATION ROUTES ==========
// Clerk user sync (for webhooks or manual sync)
router.post('/clerk/sync', syncClerkUser);

// Clerk user management
router.get('/clerk/:clerkId', getClerkUser);
router.put('/clerk/:clerkId', updateClerkUser);
router.delete('/clerk/:clerkId', deleteClerkUser);

// ========== PUSH NOTIFICATION ROUTES ==========
// Register push token for a user
router.post('/push-token', registerPushToken);
// Remove push token (on logout or disable notifications)
router.delete('/push-token', removePushToken);

export default router;