import express from 'express';
import {
  getMcqs, getMcq, createMcq, updateMcq, deleteMcq,
  getTaxonomy, toggleMcqStatus, bulkUploadMcqs
} from '../controllers/mcq.controller.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/role.js';
import { validateMcqCreate } from '../validations/mcq.validation.js';

const router = express.Router();

// Taxonomy — used by student subject cards and admin filters
router.get('/taxonomy', protect, getTaxonomy);

// Bulk upload — admin only, before /:id route to avoid conflict
router.post('/bulk', protect, authorize('admin'), bulkUploadMcqs);

// Standard CRUD
router.route('/')
  .get(protect, getMcqs)
  .post(protect, authorize('admin'), validateMcqCreate, createMcq);

router.route('/:id')
  .get(protect, getMcq)
  .put(protect, authorize('admin'), updateMcq)
  .delete(protect, authorize('admin'), deleteMcq);

// Toggle active/inactive
router.patch('/:id/toggle-status', protect, authorize('admin'), toggleMcqStatus);

export default router;
