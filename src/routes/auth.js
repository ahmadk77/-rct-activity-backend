const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { body } = require('express-validator');

// Register new participant
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('language').optional().isIn(['ar', 'en'])
], authController.register);

// Login
router.post('/login', [
  body('email').isEmail(),
  body('password').exists()
], authController.login);

// e-Consent submission
router.post('/consent', [
  body('participant_code').exists(),
  body('consented').isBoolean()
], authController.submitConsent);

// Refresh token
router.post('/refresh', authController.refreshToken);

module.exports = router;
