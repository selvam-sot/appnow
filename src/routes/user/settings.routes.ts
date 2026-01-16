import { Router } from 'express';
import {
    getUserSettings,
    updateUserSettings,
    deleteUserSettings,
    updateSingleSetting
} from '../../controllers/user-settings.controller';

const router = Router();

// GET /api/user/settings/:clerkId - Get user settings
router.get('/:clerkId', getUserSettings);

// PUT /api/user/settings/:clerkId - Update all user settings
router.put('/:clerkId', updateUserSettings);

// PATCH /api/user/settings/:clerkId/:settingKey - Update a single setting
router.patch('/:clerkId/:settingKey', updateSingleSetting);

// DELETE /api/user/settings/:clerkId - Delete user settings
router.delete('/:clerkId', deleteUserSettings);

export default router;
