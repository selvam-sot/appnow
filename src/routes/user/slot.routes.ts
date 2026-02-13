import express from 'express';
import { getServiceSlotsByDate, getNearbyAvailableDates } from './../../controllers/slot.controller';

const router = express.Router();
router.post('/slots-by-date', getServiceSlotsByDate);
router.post('/nearby-available-dates', getNearbyAvailableDates);

export default router;