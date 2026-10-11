const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const dashboardController = require('../controllers/dashboard/dashboard.controller');

const router = express.Router();

router.use(requireAuth);
router.get('/', dashboardController.getOverview);

module.exports = router;
