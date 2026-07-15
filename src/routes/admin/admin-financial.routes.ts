import express from 'express';
import { protectAdmin } from '../../middlewares/admin-auth.middleware';
import { requireSuperAdmin } from '../../middlewares/admin-role.middleware';
import {
  adminIssueRefund,
  adminAddWalletCredit,
  adminGetWalletHistory,
} from '../../controllers/admin-financial.controller';

const router = express.Router();

router.use(protectAdmin);

// Refunds — super_admin only (financial impact)
router.post('/appointments/:id/refund', requireSuperAdmin, adminIssueRefund);

// Wallet history — any admin can read
router.get('/users/:id/wallet-history', adminGetWalletHistory);

// Wallet credit — super_admin only (financial impact)
router.post('/users/:id/wallet-credit', requireSuperAdmin, adminAddWalletCredit);

export default router;
