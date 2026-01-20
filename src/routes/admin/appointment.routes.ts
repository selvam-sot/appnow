import express from 'express';
import { protect, authorize } from './../../middlewares/auth.middleware';
import { createAppointment, getAppointments, getAppointmentById, updateAppointment, deleteAppointment } from './../../controllers/appointment.controller';
import { appointmentValidationRules } from './../../utils/validation.util';

const router = express.Router();

// All admin routes require authentication and admin role
router.post('/', protect, authorize('admin'), appointmentValidationRules.create(), createAppointment);
router.get('/', protect, authorize('admin'), getAppointments);
router.get('/:id', protect, authorize('admin'), getAppointmentById);
router.put('/:id', protect, authorize('admin'), appointmentValidationRules.update(), updateAppointment);
router.delete('/:id', protect, authorize('admin'), deleteAppointment);

export default router;