import express from 'express';
import {
    getMostBookedServices,
    getMostSearchedServices,
    logServiceSearch,
} from '../../controllers/home.controller';

const router = express.Router();

router.get('/most-booked-services', getMostBookedServices);
router.get('/most-searched-services', getMostSearchedServices);
router.post('/log-search', logServiceSearch);

export default router;
