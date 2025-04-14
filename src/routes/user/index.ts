import { Router } from 'express';


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

const router = Router();

router.use('/categories', categoryRoutes);
router.use('/sub-categories', subCategoryRoutes);


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

export default router;
