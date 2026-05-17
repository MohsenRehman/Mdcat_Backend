import express from 'express';
import {
  getMyResults,
  getResultById,
  getAllResultsAdmin,
  publishTestResults,
  publishAllResults,
  scheduleResultRelease,
  getLatestStatus
} from '../controllers/result.controller.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/role.js';

const router = express.Router();

// Public route for Vercel HTTP polling fallback
router.get('/latest-status', getLatestStatus);

router.use(protect);

// Student routes
router.get('/my-results', getMyResults);
router.get('/:id', getResultById);

// Admin-only routes
router.get('/admin/all', authorize('admin'), getAllResultsAdmin);
router.post('/admin/publish-test', authorize('admin'), publishTestResults);
router.post('/admin/publish-all', authorize('admin'), publishAllResults);
router.post('/admin/schedule', authorize('admin'), scheduleResultRelease);

export default router;
