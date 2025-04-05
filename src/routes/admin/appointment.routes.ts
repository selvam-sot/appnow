import express from 'express';
import { protect, authorize } from './../../middlewares/auth.middleware';
import { createAppointment, getAppointments, getAppointmentById, updateAppointment, deleteAppointment } from './../../controllers/appointment.controller';
import { appointmentValidationRules } from './../../utils/validation.util';

const router = express.Router();

//router.post('/', protect, authorize('admin'), appointmentValidationRules.create(), createAppointment);
router.post('/', appointmentValidationRules.create(), createAppointment);
router.get('/', getAppointments);
router.get('/:id', getAppointmentById);
//router.put('/:id', protect, authorize('admin'), appointmentValidationRules.update(), updateAppointment);
router.put('/:id', protect, authorize('admin'), appointmentValidationRules.update(), updateAppointment);
router.delete('/:id', protect, authorize('admin'), deleteAppointment);

export default router;