import Subject from '../models/Subject.js';
import ExamAttempt from '../models/ExamAttempt.js';
import { ExamService } from '../services/exam.service.js';
import { sendResponse } from '../utils/response.js';
import { getIO } from '../sockets/index.js';

/**
 * @desc    Start a subject exam or resume an in-progress attempt
 * @route   POST /api/exam/start/:subjectSlug
 * @access  Student
 */
export const startExam = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 75;
    const result = await ExamService.getOrStartAttempt(req.user, req.examSubject, req.existingAttempt, limit);

    sendResponse(res, 200, true, result.isResumed ? 'Resuming in-progress exam session' : 'Exam started successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Auto-save student responses continuously during exam
 * @route   POST /api/exam/autosave/:subjectSlug
 * @access  Student
 */
export const autosaveExam = async (req, res, next) => {
  try {
    const { subjectSlug } = req.params;
    const { responses = [], timeTaken = 0 } = req.body;

    await ExamService.autosaveAttempt(req.user._id, subjectSlug, responses, timeTaken);

    sendResponse(res, 200, true, 'Exam progress autosaved');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Submit completed subject exam (Pending Admin Release)
 * @route   POST /api/exam/submit/:subjectSlug
 * @access  Student
 */
export const submitExam = async (req, res, next) => {
  try {
    const { subjectSlug } = req.params;
    const { responses = [], timeTaken = 0, violationCount = 0, submissionType = 'manual' } = req.body;

    const { attempt, subject } = await ExamService.submitAttempt(
      req.user._id,
      subjectSlug,
      responses,
      timeTaken,
      violationCount,
      submissionType
    );

    // Broadcast real-time leaderboard update if admin has configured auto-publish (otherwise wait for admin release)
    if (attempt.isPublished) {
      try {
        getIO().emit('leaderboardUpdate', {
          userId: req.user._id,
          userName: req.user.name,
          subject: subject.name,
          percentage: attempt.percentage,
          score: attempt.score,
          total: attempt.totalQuestions
        });
      } catch (socketErr) {
        console.warn('Socket emission failed:', socketErr.message);
      }
    }

    // Suppress score/answers to prevent result leakage before official admin release
    sendResponse(res, 201, true, 'Your exam has been submitted successfully. Result will be announced by admin.', {
      attemptId: attempt._id,
      subjectName: subject.name,
      status: 'pending'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Log exam violation (2-Strike Auto-Submit Rule)
 * @route   POST /api/exam/violation/:subjectSlug
 * @access  Student
 */
export const logExamViolation = async (req, res, next) => {
  try {
    const { subjectSlug } = req.params;
    const { violationType } = req.body;

    if (!violationType) {
      return sendResponse(res, 400, false, 'violationType is required');
    }

    const result = await ExamService.logViolation(req.user._id, subjectSlug, violationType);

    sendResponse(res, 200, true, result.message, result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Check attempt status for a subject
 * @route   GET /api/exam/status/:subjectSlug
 * @access  Student
 */
export const getAttemptStatus = async (req, res, next) => {
  try {
    const { subjectSlug } = req.params;
    const subject = await Subject.findOne({ slug: subjectSlug });
    if (!subject) return sendResponse(res, 404, false, 'Subject not found');

    const attempt = await ExamAttempt.findOne({ user: req.user._id, subject: subject._id });

    sendResponse(res, 200, true, 'Attempt status retrieved', {
      hasAttempted: attempt?.attemptStatus === 'completed',
      attemptStatus: attempt?.attemptStatus || 'none',
      attemptId: attempt?._id
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all exam attempts for logged-in student
 * @route   GET /api/exam/my-attempts
 * @access  Student
 */
export const getMyAttempts = async (req, res, next) => {
  try {
    const attempts = await ExamAttempt.find({ user: req.user._id })
      .populate('subject', 'name slug icon')
      .sort({ createdAt: -1 })
      .lean();

    sendResponse(res, 200, true, 'Attempts retrieved', attempts);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get subject leaderboard — top students by percentage (Published Only)
 * @route   GET /api/exam/leaderboard/:subjectSlug
 * @access  Protected
 */
export const getSubjectLeaderboard = async (req, res, next) => {
  try {
    const { subjectSlug } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const subject = await Subject.findOne({ slug: subjectSlug });
    if (!subject) return sendResponse(res, 404, false, 'Subject not found');

    // Best attempt per user for this subject (completed & published only)
    const [leaderboard, totalCount] = await Promise.all([
      ExamAttempt.aggregate([
        { $match: { subject: subject._id, attemptStatus: 'completed', isPublished: true } },
        { $sort: { percentage: -1, createdAt: 1 } },
        {
          $group: {
            _id: '$user',
            bestPercentage: { $first: '$percentage' },
            bestScore: { $first: '$score' },
            totalQuestions: { $first: '$totalQuestions' },
            timeTaken: { $first: '$timeTaken' },
            attemptedAt: { $first: '$createdAt' }
          }
        },
        { $sort: { bestPercentage: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: '$user' },
        {
          $project: {
            _id: 0,
            userId: '$_id',
            name: '$user.name',
            rollNumber: '$user.rollNumber',
            bestPercentage: 1,
            bestScore: 1,
            totalQuestions: 1,
            timeTaken: 1,
            attemptedAt: 1
          }
        }
      ]),
      ExamAttempt.distinct('user', { subject: subject._id, attemptStatus: 'completed', isPublished: true })
    ]);

    const ranked = leaderboard.map((entry, i) => ({
      rank: skip + i + 1,
      ...entry
    }));

    sendResponse(res, 200, true, 'Leaderboard retrieved', {
      subject: subject.name,
      totalParticipants: totalCount.length,
      page,
      totalPages: Math.ceil(totalCount.length / limit),
      leaderboard: ranked
    });
  } catch (error) {
    next(error);
  }
};
