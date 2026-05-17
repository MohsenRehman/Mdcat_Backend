import Subject from '../models/Subject.js';
import Mcq from '../models/Mcq.js';
import ExamAttempt from '../models/ExamAttempt.js';
import { sendResponse } from '../utils/response.js';

/**
 * @desc    Get all 4 subjects (with live MCQ counts via aggregation)
 * @route   GET /api/subjects
 * @access  Protected
 */
export const getSubjects = async (req, res, next) => {
  try {
    const subjects = await Subject.find({ isActive: true }).lean();

    // Aggregate MCQ counts per subject in a single query
    const mcqStats = await Mcq.aggregate([
      {
        $group: {
          _id: '$subject',
          totalMcqs: { $sum: 1 },
          activeMcqs: { $sum: { $cond: [{ $in: ['$status', ['active', 'published']] }, 1, 0] } },
          easy: { $sum: { $cond: [{ $eq: ['$difficulty', 'easy'] }, 1, 0] } },
          medium: { $sum: { $cond: [{ $eq: ['$difficulty', 'medium'] }, 1, 0] } },
          hard: { $sum: { $cond: [{ $eq: ['$difficulty', 'hard'] }, 1, 0] } },
        }
      }
    ]);

    // Aggregate exam attempt stats per subject (only completed for totalAttempts, only published for averageScore)
    const attemptStats = await ExamAttempt.aggregate([
      { $match: { attemptStatus: 'completed' } },
      {
        $group: {
          _id: '$subject',
          totalAttempts: { $sum: 1 },
          averageScore: { $avg: { $cond: [{ $eq: ['$isPublished', true] }, '$percentage', null] } }
        }
      }
    ]);

    // Build lookup maps
    const mcqMap = {};
    mcqStats.forEach(s => { mcqMap[s._id.toString()] = s; });
    const attemptMap = {};
    attemptStats.forEach(s => { attemptMap[s._id.toString()] = s; });

    // Merge stats into each subject
    const enriched = subjects.map(sub => {
      const id = sub._id.toString();
      const mcq = mcqMap[id] || {};
      const attempt = attemptMap[id] || {};
      return {
        ...sub,
        totalMcqs: mcq.totalMcqs || 0,
        activeMcqs: mcq.activeMcqs || 0,
        difficultyDistribution: {
          easy: mcq.easy || 0,
          medium: mcq.medium || 0,
          hard: mcq.hard || 0,
        },
        totalAttempts: attempt.totalAttempts || 0,
        averageScore: attempt.averageScore ? parseFloat(attempt.averageScore.toFixed(1)) : 0,
      };
    });

    sendResponse(res, 200, true, 'Subjects retrieved', enriched);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get one subject by slug with full analytics
 * @route   GET /api/subjects/:slug
 * @access  Protected
 */
export const getSubjectBySlug = async (req, res, next) => {
  try {
    const subject = await Subject.findOne({ slug: req.params.slug }).lean();
    if (!subject) return sendResponse(res, 404, false, 'Subject not found');

    const id = subject._id;

    const [mcqStats, attemptStats, chapterStats] = await Promise.all([
      Mcq.aggregate([
        { $match: { subject: id } },
        {
          $group: {
            _id: null,
            totalMcqs: { $sum: 1 },
            activeMcqs: { $sum: { $cond: [{ $in: ['$status', ['active', 'published']] }, 1, 0] } },
            easy: { $sum: { $cond: [{ $eq: ['$difficulty', 'easy'] }, 1, 0] } },
            medium: { $sum: { $cond: [{ $eq: ['$difficulty', 'medium'] }, 1, 0] } },
            hard: { $sum: { $cond: [{ $eq: ['$difficulty', 'hard'] }, 1, 0] } },
          }
        }
      ]),
      ExamAttempt.aggregate([
        { $match: { subject: id, attemptStatus: 'completed' } },
        {
          $group: {
            _id: null,
            totalAttempts: { $sum: 1 },
            averageScore: { $avg: { $cond: [{ $eq: ['$isPublished', true] }, '$percentage', null] } },
            highestScore: { $max: { $cond: [{ $eq: ['$isPublished', true] }, '$percentage', null] } }
          }
        }
      ]),
      Mcq.aggregate([
        { $match: { subject: id } },
        { $group: { _id: '$chapter', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { chapter: '$_id', count: 1, _id: 0 } }
      ])
    ]);

    sendResponse(res, 200, true, 'Subject details retrieved', {
      ...subject,
      ...(mcqStats[0] || {}),
      difficultyDistribution: {
        easy: mcqStats[0]?.easy || 0,
        medium: mcqStats[0]?.medium || 0,
        hard: mcqStats[0]?.hard || 0,
      },
      ...(attemptStats[0] || {}),
      chapterBreakdown: chapterStats
    });
  } catch (error) {
    next(error);
  }
};
