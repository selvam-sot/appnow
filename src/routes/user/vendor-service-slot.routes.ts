import express from 'express';
import { getVendorServiceSlots, getVendorServiceSlotsByDate, checkSlotAvailability } from './../../controllers/process-vendor-service-slot.controller';

const router = express.Router();

router.post('/', getVendorServiceSlots);
router.post('/by-date', getVendorServiceSlotsByDate);
router.post('/check-availability', checkSlotAvailability);

export default router;