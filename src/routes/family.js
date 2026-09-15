const express = require('express');
const router = express.Router();
const familyController = require('../controllers/familyController');
const authMiddleware = require('../middleware/auth');

// All family routes require authentication
router.use(authMiddleware);

// Invite a family supporter
router.post('/invitations', familyController.inviteSupporter);

// Get family coaches for a user
router.get('/coaches', familyController.getFamilyCoaches);

// Submit family interaction
router.post('/interactions', familyController.submitInteraction);

// Get weekly family rankings
router.get('/rankings', familyController.getWeeklyRankings);

module.exports = router;