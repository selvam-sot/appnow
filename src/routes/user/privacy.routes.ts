import express from 'express';
import { protect } from '../../middlewares/auth.middleware';
import {
  exportUserData,
  deleteUserAccount,
  updateSmsConsent,
  updateEmailConsent,
} from '../../controllers/data-privacy.controller';

const router = express.Router();

// All privacy routes require auth — only the user themselves can request these
router.use(protect);

router.get('/export', exportUserData);
router.post('/delete-account', deleteUserAccount);
router.put('/sms-consent', updateSmsConsent);
router.put('/email-consent', updateEmailConsent);

export default router;
