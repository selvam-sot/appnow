import express from 'express';
import { protectAdmin } from '../../middlewares/admin-auth.middleware';
import { getAppointments } from '../../controllers/manage-appointment.controller';

const router = express.Router();

// All admin routes require authentication
router.use(protectAdmin);

router.post('/', getAppointments);

export default router;