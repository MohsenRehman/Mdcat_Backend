import express from 'express';
import { getSubjects, getSubjectBySlug } from '../controllers/subject.controller.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// GET /api/subjects - All 4 subjects with live stats
router.get('/', protect, getSubjects);

// GET /api/subjects/:slug - Single subject full details
router.get('/:slug', protect, getSubjectBySlug);

export default router;
