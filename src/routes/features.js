const express = require('express');
const router = express.Router();
const featureController = require('../controllers/featureController');
const authMiddleware = require('../middleware/auth');

// Admin routes (require authentication)
router.use(authMiddleware);

// Get all feature flags (admin)
router.get('/', featureController.getAllFeatureFlags);

// Update feature flag (admin)
router.put('/:featureName', featureController.updateFeatureFlag);

// Get user-specific feature flags
router.get('/user', featureController.getUserFeatureFlags);

module.exports = router;