import ExamAttempt from '../models/ExamAttempt.js';
import Subject from '../models/Subject.js';
import { sendResponse } from '../utils/response.js';

/**
 * @desc    Middleware to enforce strict single attempt rule per subject exam
 *          Blocks access if attemptStatus is 'completed'
 */
export const attemptLimiter = async (req, res, next) => {
  try {
    const { subjectSlug } = req.params;

    const subject = await Subject.findOne({ slug: subjectSlug, isActive: true });
    if (!subject) {
      return sendResponse(res, 404, false, 'Subject not found');
    }

    const existingAttempt = await ExamAttempt.findOne({
      user: req.user._id,
      subject: subject._id
    });

    if (existingAttempt && existingAttempt.attemptStatus === 'completed') {
      if (existingAttempt.isFreeTrial && req.user.role !== 'admin' && !req.user.isPremium) {
        return res.status(403).json({
          success: false,
          freeTrialLocked: true,
          message: 'Free trial completed. Subscription required to unlock the full 75-MCQ exam.'
        });
      }
      return sendResponse(res, 403, false, 'You have already attempted this exam');
    }

    // Attach subject to req object for convenience in the controller
    req.examSubject = subject;
    req.existingAttempt = existingAttempt;

    next();
  } catch (error) {
    next(error);
  }
};
