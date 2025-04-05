import express from 'express';

import { getVendorServiceById, getVendorServiceList } from './../../controllers/vendor-service.controller';
const router = express.Router();

router.get('/:id', getVendorServiceById);
router.post('/', getVendorServiceList);

export default router;