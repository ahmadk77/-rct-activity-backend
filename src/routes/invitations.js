const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const invitationController = require('../controllers/invitationController');
const authMiddleware = require('../middleware/auth');

// Create invitation
router.post('/', 
  authMiddleware,
  [
    body('invitee_email').optional().isEmail().withMessage('Invalid email'),
    body('invitation_type').optional().isIn(['family', 'friend', 'general']).withMessage('Invalid invitation type')
  ],
  invitationController.createInvitation
);

// Accept invitation
router.post('/:invite_code/accept', 
  authMiddleware,
  invitationController.acceptInvitation
);

// Get user's invitations
router.get('/', 
  authMiddleware,
  invitationController.getUserInvitations
);

// Get invitation statistics
router.get('/stats', 
  authMiddleware,
  invitationController.getInvitationStats
);

// Revoke invitation
router.post('/:invite_code/revoke', 
  authMiddleware,
  invitationController.revokeInvitation
);

// Validate invitation (public endpoint for registration)
router.get('/:invite_code/validate', 
  invitationController.validateInvitation
);

module.exports = router;
