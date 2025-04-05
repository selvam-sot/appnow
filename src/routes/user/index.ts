import { Router } from 'express';
import categoryRoutes from './category.routes';
import subCategoryRoutes from './sub-category.routes';

const router = Router();

router.use('/categories', categoryRoutes);
router.use('/sub-categories', subCategoryRoutes);

export default router;
