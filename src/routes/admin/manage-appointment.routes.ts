import express from 'express';
import { body } from 'express-validator';
import { protectAdmin } from '../../middlewares/admin-auth.middleware';
import { getAppointments, getAppointmentById, updateAppointmentStatus } from '../../controllers/manage-appointment.controller';

const router = express.Router();

// All admin routes require authentication
router.use(protectAdmin);

router.post('/', getAppointments);
router.get('/:id', getAppointmentById);
router.patch('/:id/status', [
    body('status').notEmpty().withMessage('Status is required'),
    body('reason').optional().isString()
], updateAppointmentStatus);

export default router;