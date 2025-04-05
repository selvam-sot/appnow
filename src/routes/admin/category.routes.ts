import express from 'express';
import * as categoryController from '../../controllers/category.controller';

const router = express.Router();

// Base routes for categories
router.route('/')
  .get(categoryController.getAllCategories)
  .post(categoryController.createCategory);

router.route('/:id')
  .get(categoryController.getCategory)
  .put(categoryController.updateCategory)
  .delete(categoryController.deleteCategory);

// Special routes for toggling states
router.route('/:id/toggle-favorite')
  .patch(categoryController.toggleFavorite);

router.route('/:id/toggle-active')
  .patch(categoryController.toggleActive);

export default router;