import express from 'express';
import { getDashboardStats, getStudentDashboardStats } from '../controllers/analytics.controller.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/role.js';

const router = express.Router();

router.get('/dashboard', protect, authorize('admin'), getDashboardStats);
router.get('/student-stats', protect, authorize('student', 'admin'), getStudentDashboardStats);

export default router;
