import express from 'express';
import { getServiceSlots } from './../../controllers/manage-appointment.controller';

const router = express.Router();

router.post('/service-slots', getServiceSlots);

export default router;