import express from 'express';
import { searchVendorsNearMe } from '../../controllers/geo-search.controller';

const router = express.Router();

// Public - "near me" search doesn't require login
router.get('/near-me', searchVendorsNearMe);

export default router;
