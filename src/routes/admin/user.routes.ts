import express from 'express';
import { 
    signupUser,
    loginUser,
    activateUser,
    logoutUser,
    getUserProfile,
    updateUserProfile,
    deleteUserAccount
} from './../../controllers/user.controller';
import { protect, authorize } from './../../middlewares/auth.middleware';
import { userValidationRules } from './../../utils/validation.util';

const router = express.Router();

// Public routes
router.post('/signup', userValidationRules.create(), signupUser);
router.post('/login', userValidationRules.login(), loginUser);
router.get('/activate/:activationToken', activateUser);

// Protected routes
router.post('/logout', protect, logoutUser);
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, userValidationRules.update(), updateUserProfile);
router.delete('/account', authorize('admin'), deleteUserAccount);

export default router;

