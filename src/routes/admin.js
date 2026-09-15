const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/auth');

// Get all participants (de-identified)
router.get('/participants', authMiddleware, adminController.getAllParticipants);

// Get participant activity data
router.get('/participant/:code/activity', authMiddleware, adminController.getParticipantActivity);

// Toggle feature flag
router.post('/feature-flags', authMiddleware, adminController.toggleFeatureFlag);

// Get feature flags
router.get('/feature-flags', authMiddleware, adminController.getFeatureFlags);

// Export data (SPSS/Excel format)
router.get('/export/data', authMiddleware, adminController.exportData);

// Get statistics
router.get('/statistics', authMiddleware, adminController.getStatistics);

module.exports = router;
