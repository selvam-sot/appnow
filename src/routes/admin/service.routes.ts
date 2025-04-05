import express from 'express';
import { createService, getServices, getServiceById, updateService, deleteService } from './../../controllers/service.controller';

const router = express.Router();

//router.post('/', protect, authorize('admin'), serviceValidationRules.create(), createService);
router.post('/', createService);
router.get('/', getServices);
router.get('/:id', getServiceById);
//router.put('/:id', protect, authorize('admin'), serviceValidationRules.update(), updateService);
router.put('/:id', updateService);
router.delete('/:id', deleteService);

export default router;