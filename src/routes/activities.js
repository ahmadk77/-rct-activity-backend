const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activityController');
const authMiddleware = require('../middleware/auth');

// Submit activity data
router.post('/submit', authMiddleware, activityController.submitActivity);

// Get activity data for date range
router.get('/history', authMiddleware, activityController.getActivityHistory);

// Get today's activity
router.get('/today', authMiddleware, activityController.getTodayActivity);

// Sync smartwatch data
router.post('/smartwatch-sync', authMiddleware, activityController.syncSmartwatch);

module.exports = router;
