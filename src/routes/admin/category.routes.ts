import express from 'express';
import { protect, authorize } from '../../middlewares/auth.middleware';
import * as categoryController from '../../controllers/category.controller';

const router = express.Router();

// All admin routes require authentication and admin role
router.route('/')
  .get(protect, authorize('admin'), categoryController.getAllCategories)
  .post(protect, authorize('admin'), categoryController.createCategory);

router.route('/:id')
  .get(protect, authorize('admin'), categoryController.getCategory)
  .put(protect, authorize('admin'), categoryController.updateCategory)
  .delete(protect, authorize('admin'), categoryController.deleteCategory);

// Special routes for toggling states
router.route('/:id/toggle-favorite')
  .patch(protect, authorize('admin'), categoryController.toggleFavorite);

router.route('/:id/toggle-active')
  .patch(protect, authorize('admin'), categoryController.toggleActive);

export default router;
