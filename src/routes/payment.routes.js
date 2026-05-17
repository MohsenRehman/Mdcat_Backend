import express from 'express';
import { createCheckoutSession, verifyPayment } from '../controllers/payment.controller.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.post('/checkout', createCheckoutSession);
router.post('/verify', verifyPayment);

export default router;
