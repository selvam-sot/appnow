import express from 'express';
import { createSubCategory, getSubCategories, getSubCategory, updateSubCategory, deleteSubCategory } from './../../controllers/sub-category.controller';

const router = express.Router();


router.route('/')
    .get(getSubCategories)
    .post(createSubCategory);

router.route('/:id')
    .get(getSubCategory)
    .put(updateSubCategory)
    .delete(deleteSubCategory);


export default router;