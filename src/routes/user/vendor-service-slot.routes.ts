import express from 'express';
import { getVendorServiceSlots, getVendorServiceSlotsByDate } from './../../controllers/process-vendor-service-slot.controller';

const router = express.Router();

router.post('/', getVendorServiceSlots);
router.post('/by-date', getVendorServiceSlotsByDate);

export default router;