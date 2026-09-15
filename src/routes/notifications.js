const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middleware/auth');

// Register FCM token
router.post('/register-token', authMiddleware, notificationController.registerFCMToken);

// Test notification (for development)
router.post('/test', authMiddleware, notificationController.testNotification);

// Send scheduled notification
router.post('/scheduled', authMiddleware, notificationController.sendScheduledNotification);

// Send family interaction notification
router.post('/family-interaction', authMiddleware, notificationController.sendFamilyInteractionNotification);

// Send achievement notification
router.post('/achievement', authMiddleware, notificationController.sendAchievementNotification);

module.exports = router;