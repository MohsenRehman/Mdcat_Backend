import express from 'express';
import { startExam, autosaveExam, submitExam, logExamViolation, getAttemptStatus, getMyAttempts, getSubjectLeaderboard } from '../controllers/exam.controller.js';
import { protect } from '../middleware/auth.js';
import { attemptLimiter } from '../middleware/attemptLimiter.js';

const router = express.Router();

// Start randomized subject exam with attemptLimiter middleware
router.post('/start/:subjectSlug', protect, attemptLimiter, startExam);

// Auto-save exam progress
router.post('/autosave/:subjectSlug', protect, autosaveExam);

// Submit completed exam
router.post('/submit/:subjectSlug', protect, submitExam);

// Log security violation (2-strike rule)
router.post('/violation/:subjectSlug', protect, logExamViolation);

// Check attempt status for UI rendering
router.get('/status/:subjectSlug', protect, getAttemptStatus);

// Get current user's attempt history
router.get('/my-attempts', protect, getMyAttempts);

// Subject-specific leaderboard
router.get('/leaderboard/:subjectSlug', protect, getSubjectLeaderboard);

export default router;
