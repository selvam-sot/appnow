import express from 'express';
import { getSubCategoryList } from './../../controllers/sub-category.controller';

const router = express.Router();

router.post('/', getSubCategoryList);

export default router;
