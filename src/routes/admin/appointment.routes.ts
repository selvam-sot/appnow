import express from 'express';
import { protectAdmin } from '../../middlewares/admin-auth.middleware';
import { createAppointment, getAppointments, getAppointmentById, updateAppointment, deleteAppointment } from '../../controllers/appointment.controller';
import { appointmentValidationRules } from '../../utils/validation.util';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(protectAdmin);

router.post('/', appointmentValidationRules.create(), createAppointment);
router.get('/', getAppointments);
router.get('/:id', getAppointmentById);
router.put('/:id', appointmentValidationRules.update(), updateAppointment);
router.delete('/:id', deleteAppointment);

export default router;