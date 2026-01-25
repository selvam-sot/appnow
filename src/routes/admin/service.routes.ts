import express from 'express';
import { protectAdmin } from '../../middlewares/admin-auth.middleware';
import { createService, getServices, getServiceById, updateService, deleteService } from '../../controllers/service.controller';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(protectAdmin);

router.post('/', createService);
router.get('/', getServices);
router.get('/:id', getServiceById);
router.put('/:id', updateService);
router.delete('/:id', deleteService);

export default router;
