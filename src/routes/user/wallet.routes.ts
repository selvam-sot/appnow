import express from 'express';
import { getWallet, applyWalletToPayment } from '../../controllers/wallet.controller';

const router = express.Router();

// User identified by `x-clerk-id` header (same pattern as address-book).
// No internal-JWT protect middleware — customer app is Clerk-authenticated.

router.get('/wallet', getWallet);
router.post('/wallet/apply-to-payment', applyWalletToPayment);

export default router;
