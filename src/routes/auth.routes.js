import express from 'express';
import { register, login, getMe, updateProfilePicture, adminLogin, validateAdmin, forgotPassword, resetPassword } from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.js';
import { authMiddleware, adminOnly } from '../middleware/roleAuth.js';
import { adminLoginRateLimiter } from '../middleware/rateLimiter.js';
import { validateRegister, validateLogin } from '../validations/auth.validation.js';

const router = express.Router();

router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);
router.get('/me', protect, getMe);
router.put('/profile-picture', protect, updateProfilePicture);

// Dedicated private admin login route with rate limiting
router.post('/admin/login', adminLoginRateLimiter, validateLogin, adminLogin);

// Protected admin validation endpoint
router.get('/validate-admin', authMiddleware, adminOnly, validateAdmin);

// Forgot & Reset Password
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);

export default router;
