import express from 'express';
import { getGlobalLeaderboard } from '../controllers/leaderboard.controller.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/global', protect, getGlobalLeaderboard);

export default router;
