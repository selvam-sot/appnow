import express from 'express';
import { getServiceList, getServiceById } from './../../controllers/service.controller';
import { cacheServices } from '../../middlewares/cache.middleware';

const router = express.Router();

router.get('/:id', cacheServices, getServiceById);
router.post('/', getServiceList);

export default router;