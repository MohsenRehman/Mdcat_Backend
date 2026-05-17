import express from 'express';
import { getTests, getTest, createTest, updateTest, submitTest, generatePracticeTest } from '../controllers/test.controller.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/role.js';
import { checkPremium } from '../middleware/premium.js';

const router = express.Router();

router.post('/generate-practice', protect, authorize('student', 'admin'), generatePracticeTest);

router.route('/')
  .get(protect, getTests)
  .post(protect, authorize('admin'), createTest);

router.route('/:id')
  .get(protect, getTest)
  .put(protect, authorize('admin'), updateTest);

// Student attempts a test
router.post('/:id/submit', protect, checkPremium, submitTest);

export default router;
