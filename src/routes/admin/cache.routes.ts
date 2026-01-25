import express from 'express';
import { protectAdmin } from '../../middlewares/admin-auth.middleware';
import { clearCache, getCacheStats } from '../../middlewares/cache.middleware';

const router = express.Router();

// Cache management requires admin authentication
router.use(protectAdmin);

/**
 * @swagger
 * /api/admin/cache/stats:
 *   get:
 *     summary: Get cache statistics
 *     tags: [Cache]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cache statistics
 */
router.get('/stats', getCacheStats);

/**
 * @swagger
 * /api/admin/cache/clear:
 *   post:
 *     summary: Clear all cache entries
 *     tags: [Cache]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cache cleared successfully
 */
router.post('/clear', clearCache);

export default router;
