import express from 'express';
import { getVendorServiceSlots } from './../../controllers/process-vendor-service-slot.controller';

const router = express.Router();

router.post('/', getVendorServiceSlots);

export default router;