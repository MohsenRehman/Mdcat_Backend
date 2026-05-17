import express from 'express';
import { getUsers, getUserById, getUserByRollNumber } from '../controllers/user.controller.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/role.js';

const router = express.Router();

// Admin only routes
router.use(protect);
router.use(authorize('admin'));

router.route('/')
  .get(getUsers);

router.route('/roll/:rollNumber')
  .get(getUserByRollNumber);

router.route('/:id')
  .get(getUserById);

export default router;
