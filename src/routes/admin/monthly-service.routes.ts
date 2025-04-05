import express from 'express';
import { protect, authorize } from './../../middlewares/auth.middleware';
import { asyncHandler } from './../../utils/asyncHandler.util';
import { createMonthlyService, getMonthlyServices, getMonthlyServiceById, updateMonthlyService, deleteMonthlyService } from './../../controllers/monthly-service.controller';
import { monthlyServiceValidationRules } from './../../utils/validation.util';

const router = express.Router();

//router.post('/', protect, authorize('admin'), monthlyServiceValidationRules.create(), createMonthlyService);
//router.post('/', monthlyServiceValidationRules.create(), createMonthlyService);
router.get('/', getMonthlyServices);
router.get('/:id', getMonthlyServiceById);
//router.put('/:id', protect, authorize('admin'), monthlyServiceValidationRules.update(), updateMonthlyService);
//router.put('/:id', monthlyServiceValidationRules.update(), updateMonthlyService);
router.delete('/:id', protect, authorize('admin'), deleteMonthlyService);

export default router;