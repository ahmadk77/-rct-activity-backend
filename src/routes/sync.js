const express = require('express');
const router = express.Router();
const syncController = require('../controllers/syncController');
const authMiddleware = require('../middleware/auth');

// Sync pending data from client
router.post('/push', authMiddleware, syncController.pushSync);

// Pull latest data from server
router.get('/pull', authMiddleware, syncController.pullSync);

// Get sync status
router.get('/status', authMiddleware, syncController.getSyncStatus);

module.exports = router;
