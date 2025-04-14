import express from 'express';
import { getServiceSlotsByDate } from './../../controllers/slot.controller';

const router = express.Router();
router.post('/slots-by-date', getServiceSlotsByDate);

export default router;