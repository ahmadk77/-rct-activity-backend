const express = require('express');
const router = express.Router();
const exerciseController = require('../controllers/exerciseController');
const authMiddleware = require('../middleware/auth');

// Get available exercises (public)
router.get('/', exerciseController.getExercises);

// Routes that require authentication
router.use(authMiddleware);

// Complete an exercise
router.post('/:exerciseId/complete', exerciseController.completeExercise);

// Get user exercise history
router.get('/history', exerciseController.getUserExerciseHistory);

module.exports = router;