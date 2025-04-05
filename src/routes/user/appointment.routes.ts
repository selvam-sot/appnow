import express from 'express';
import { protect, authorize } from './../../middlewares/auth.middleware';
import { appointmentOperations } from './../../controllers/appointment.controller';
import { appointmentValidationRules } from './../../utils/validation.util';

const router = express.Router();

router.post('/', appointmentOperations);

export default router;