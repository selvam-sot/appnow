import express from 'express';
import { getVendors } from './../../controllers/vendor.controller';

const router = express.Router();

router.get('/', getVendors);

export default router;