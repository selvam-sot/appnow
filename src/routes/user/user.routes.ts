
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
import { protect, authorize } from '../../middlewares/auth.middleware';
import { userValidationRules } from '../../utils/validation.util';

const router = express.Router();

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

// Public routes
router.post('/signup', userValidationRules.create(), signupUser);
router.post('/login', userValidationRules.login(), loginUser);
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

export default router;