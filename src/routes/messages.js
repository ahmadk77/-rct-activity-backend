const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const authMiddleware = require('../middleware/auth');

// Get messages for user
router.get('/', authMiddleware, messageController.getMessages);

// Mark message as read
router.patch('/:id/read', authMiddleware, messageController.markAsRead);

// React to message
router.patch('/:id/react', authMiddleware, messageController.reactToMessage);

// Get fallback messages (for offline/backup)
router.get('/fallback/list', authMiddleware, messageController.getFallbackMessages);

// Generate AI message
router.post('/generate', authMiddleware, messageController.generateAIMessage);

module.exports = router;
