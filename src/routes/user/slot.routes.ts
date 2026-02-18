import express from 'express';
import { getServiceSlotsByDate, getNearbyAvailableDates, getVendorServicesWithSlots } from './../../controllers/slot.controller';

const router = express.Router();
router.post('/slots-by-date', getServiceSlotsByDate);
router.post('/nearby-available-dates', getNearbyAvailableDates);
router.post('/vendor-services-with-slots', getVendorServicesWithSlots);

export default router;