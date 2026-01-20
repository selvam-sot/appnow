import express from 'express';
import { protect, authorize } from '../../middlewares/auth.middleware';
import { createSubCategory, getSubCategories, getSubCategory, updateSubCategory, deleteSubCategory } from './../../controllers/sub-category.controller';

const router = express.Router();

// All admin routes require authentication and admin role
router.route('/')
    .get(protect, authorize('admin'), getSubCategories)
    .post(protect, authorize('admin'), createSubCategory);

router.route('/:id')
    .get(protect, authorize('admin'), getSubCategory)
    .put(protect, authorize('admin'), updateSubCategory)
    .delete(protect, authorize('admin'), deleteSubCategory);

export default router;
