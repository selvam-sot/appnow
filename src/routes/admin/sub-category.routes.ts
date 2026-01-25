import express from 'express';
import { protectAdmin } from '../../middlewares/admin-auth.middleware';
import { createSubCategory, getSubCategories, getSubCategory, updateSubCategory, deleteSubCategory } from '../../controllers/sub-category.controller';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(protectAdmin);

router.route('/')
    .get(getSubCategories)
    .post(createSubCategory);

router.route('/:id')
    .get(getSubCategory)
    .put(updateSubCategory)
    .delete(deleteSubCategory);

export default router;
