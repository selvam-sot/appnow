import { Router } from 'express';

import userRoutes from './user.routes';
import categoryRoutes from './category.routes';
import subCategoryRoutes from './sub-category.routes';
import serviceRoutes from './service.routes';
import vendorRoutes from './vendor.routes';
import vendorServiceRoutes from './vendor-service.routes';
import vendorServiceSlotRoutes from './vendor-service-slot.routes';
import appointmentRoutes from './appointment.routes';
import manageAppointmentRoutes from './manage-appointment.routes';
import monthlyServiceRoutes from './monthly-service.routes';
import slotRoutes from './slot.routes';
import paymentRoutes from './payment.routes';
import settingsRoutes from './settings.routes';
import notificationRoutes from './notification.routes';
import reviewRoutes from '../review.routes';
import slotLockRoutes from './slot-lock.routes';


const router = Router();

router.use('/reviews', reviewRoutes);
router.use('/categories', categoryRoutes);
router.use('/sub-categories', subCategoryRoutes);
router.use('/services', serviceRoutes);
router.use('/vendors', vendorRoutes);
router.use('/vendor-services', vendorServiceRoutes);
router.use('/vendor-service-slots', vendorServiceSlotRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/manage-appointments', manageAppointmentRoutes);
router.use('/monthly-service', monthlyServiceRoutes);
router.use('/slots', slotRoutes);
router.use('/users', userRoutes);
router.use('/payments', paymentRoutes);
router.use('/settings', settingsRoutes);
router.use('/notifications', notificationRoutes);
router.use('/slot-locks', slotLockRoutes);


export default router;
