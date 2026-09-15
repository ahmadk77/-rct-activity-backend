const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const socialController = require('../controllers/socialController');
const authMiddleware = require('../middleware/auth');

// Get user progress (public endpoint for invitation flow)
router.get('/user/:user_id/progress', 
  socialController.getUserProgress
);

// Send reaction
router.post('/reactions', 
  authMiddleware,
  [
    body('receiver_id').isInt().withMessage('Invalid receiver ID'),
    body('emoji').notEmpty().withMessage('Emoji is required'),
    body('reaction_type').optional().isIn(['encouragement', 'celebration', 'support']).withMessage('Invalid reaction type')
  ],
  socialController.sendReaction
);

// Get reactions for current user
router.get('/reactions', 
  authMiddleware,
  socialController.getReactions
);

// Mark reactions as read
router.post('/reactions/mark-read', 
  authMiddleware,
  socialController.markReactionsAsRead
);

// Get available emojis
router.get('/emojis', 
  socialController.getAvailableEmojis
);

module.exports = router;
