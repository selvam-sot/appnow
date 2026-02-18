import express from 'express';
import {
    getMostBookedServices,
    getMostSearchedServices,
    getPopularServices,
    logServiceSearch,
} from '../../controllers/home.controller';

const router = express.Router();

router.get('/most-booked-services', getMostBookedServices);
router.get('/most-searched-services', getMostSearchedServices);
router.get('/popular-services', getPopularServices);
router.post('/log-search', logServiceSearch);

export default router;
