import express from 'express';
import { getServiceList, getServiceById } from './../../controllers/service.controller';

const router = express.Router();

router.get('/:id', getServiceById);
router.post('/', getServiceList);

export default router;