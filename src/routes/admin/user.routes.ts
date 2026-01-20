import express from 'express';
import {
    signupUser,
    loginUser,
    activateUser,
    logoutUser,
    getUserProfile,
    updateUserProfile,
    deleteUserAccount,
    getUsers
} from '../../controllers/user.controller';
import { protect, authorize } from './../../middlewares/auth.middleware';
import { userValidationRules } from './../../utils/validation.util';

const router = express.Router();

// Public routes (for admin login)
router.post('/signup', userValidationRules.create(), signupUser);
router.post('/login', userValidationRules.login(), loginUser);
router.get('/activate/:activationToken', activateUser);

// Protected routes (require authentication)
router.post('/logout', protect, logoutUser);
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, userValidationRules.update(), updateUserProfile);

// Admin-only routes
router.delete('/account', protect, authorize('admin'), deleteUserAccount);
router.get('/', protect, authorize('admin'), getUsers);

export default router;
