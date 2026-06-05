import express from 'express';
import { protect } from '../../middlewares/auth.middleware';
import {
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  updateNotificationPrefs,
  getNotificationPrefs,
} from '../../controllers/address-book.controller';

const router = express.Router();

// All routes require auth
router.use(protect);

// Address book
router.get('/addresses', listAddresses);
router.post('/addresses', createAddress);
router.put('/addresses/:addressId', updateAddress);
router.delete('/addresses/:addressId', deleteAddress);
router.patch('/addresses/:addressId/default', setDefaultAddress);

// Notification preferences (per-type)
router.get('/notification-prefs', getNotificationPrefs);
router.put('/notification-prefs', updateNotificationPrefs);

export default router;
