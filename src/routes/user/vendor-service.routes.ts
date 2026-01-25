import express from 'express';

import { getVendorServiceById, getVendorServiceList, searchVendorServices } from './../../controllers/vendor-service.controller';
import { cacheVendorServices } from '../../middlewares/cache.middleware';

const router = express.Router();

/**
 * @swagger
 * /api/v1/customer/vendor-services/search:
 *   get:
 *     summary: Advanced search for vendor services
 *     description: Search with filters, sorting, and pagination
 *     tags: [Vendor Services]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Text search query
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *       - in: query
 *         name: subCategoryId
 *         schema:
 *           type: string
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *       - in: query
 *         name: minRating
 *         schema:
 *           type: number
 *       - in: query
 *         name: maxRating
 *         schema:
 *           type: number
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [price, rating, duration, name, createdAt]
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 20
 *     responses:
 *       200:
 *         description: Search results with pagination
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 */
router.get('/search', cacheVendorServices, searchVendorServices);

router.get('/:id', cacheVendorServices, getVendorServiceById);
router.post('/', getVendorServiceList);

export default router;