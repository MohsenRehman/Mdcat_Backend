import Payment from '../models/Payment.js';
import User from '../models/User.js';
import ExamAttempt from '../models/ExamAttempt.js';
import { sendResponse } from '../utils/response.js';
import crypto from 'crypto';

export const createCheckoutSession = async (req, res, next) => {
  try {
    const { amount, method } = req.body;

    // Simulate creating a payment session with external provider
    const transactionId = crypto.randomBytes(16).toString('hex');

    const payment = await Payment.create({
      user: req.user._id,
      amount,
      method,
      status: 'pending',
      transactionId
    });

    sendResponse(res, 200, true, 'Checkout session created', {
      paymentId: payment._id,
      transactionId,
      amount,
      method
    });
  } catch (error) {
    next(error);
  }
};

export const verifyPayment = async (req, res, next) => {
  try {
    const { transactionId, status } = req.body;

    const payment = await Payment.findOne({ transactionId });
    if (!payment) {
      return sendResponse(res, 404, false, 'Payment not found');
    }

    if (status === 'completed') {
      payment.status = 'completed';
      await payment.save();

      // Grant premium access for 30 days
      const user = await User.findById(payment.user);
      user.isPremium = true;
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 30);
      user.premiumExpiry = expiry;
      await user.save();

      // Automatically reset and delete any previously attempted free trial MCQs/sessions
      await ExamAttempt.deleteMany({ user: user._id, isFreeTrial: true });

      sendResponse(res, 200, true, 'Payment verified and premium activated successfully', {
        user: {
          isPremium: true,
          premiumExpiry: expiry
        }
      });
    } else {
      payment.status = 'failed';
      await payment.save();
      sendResponse(res, 400, false, 'Payment failed');
    }
  } catch (error) {
    next(error);
  }
};
