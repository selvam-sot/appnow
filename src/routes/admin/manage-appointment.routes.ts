import express from 'express';
import { getAppointments } from './../../controllers/manage-appointment.controller';

const router = express.Router();

router.post('/', getAppointments);

export default router;