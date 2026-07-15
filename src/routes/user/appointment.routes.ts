import express from 'express';
import { protect, authorize } from './../../middlewares/auth.middleware';
import { appointmentOperations } from './../../controllers/appointment.controller';
import {
  createRecurringSeries,
  cancelRecurringSeries,
} from './../../controllers/recurring-appointment.controller';
import { appointmentValidationRules } from './../../utils/validation.util';

const router = express.Router();

router.post('/', appointmentOperations);
router.post('/recurring', createRecurringSeries);
router.delete('/recurring/:seriesId', cancelRecurringSeries);

export default router;
