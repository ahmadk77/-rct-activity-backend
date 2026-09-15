const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');

// Get user profile
router.get('/profile', authMiddleware, userController.getProfile);

// Update cultural profile
router.post('/cultural-profile', authMiddleware, userController.updateCulturalProfile);

// Get cultural profile
router.get('/cultural-profile', authMiddleware, userController.getCulturalProfile);

// Update language preference
router.patch('/language', authMiddleware, userController.updateLanguage);

module.exports = router;
