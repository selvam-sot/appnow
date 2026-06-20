import express from 'express';
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

// Auth: customer app is Clerk-authenticated. The controllers identify the
// user by clerkId (x-clerk-id header / query / body) rather than the
// internal-JWT `protect` middleware, which the customer client doesn't carry.

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
