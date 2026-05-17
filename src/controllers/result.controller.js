import ExamAttempt from '../models/ExamAttempt.js';
import { sendResponse } from '../utils/response.js';
import { getIO } from '../sockets/index.js';

/* ─── Helper: recalculate global ranks for all published results ─── */
const recalculateRanks = async () => {
  const published = await ExamAttempt.find({ isPublished: true })
    .sort({ percentage: -1, correctAnswers: -1, createdAt: 1 });

  const total = published.length;
  for (let i = 0; i < total; i++) {
    const rank = i + 1;
    const percentile = parseFloat(((total - rank) / total * 100).toFixed(1));
    await ExamAttempt.findByIdAndUpdate(published[i]._id, { rank, percentile });
  }
};

/* ════════════════════════════
   STUDENT — get my results
   Only returns published results (or pending status)
════════════════════════════ */
export const getMyResults = async (req, res, next) => {
  try {
    // Return student's completed exam attempts
    const results = await ExamAttempt.find({ user: req.user._id, attemptStatus: 'completed' })
      .populate('subject', 'name slug icon')
      .sort('-createdAt')
      .lean();

    // Deduplicate by subject so each subject appears exactly once (latest completed attempt)
    const uniqueResultsMap = {};
    results.forEach(r => {
      const sid = r.subject?._id?.toString() || r.subject?.toString();
      if (sid && !uniqueResultsMap[sid]) {
        uniqueResultsMap[sid] = r;
      }
    });
    const uniqueResults = Object.values(uniqueResultsMap);

    // Map subject to test so frontend Results.jsx (which expects r.test?.title) works perfectly
    const mappedResults = uniqueResults.map(r => ({
      ...r,
      test: r.subject ? { title: `${r.subject.name} Exam`, duration: r.totalQuestions } : { title: 'Subject Exam', duration: 60 }
    }));

    // Strip sensitive data from unpublished results
    const safeResults = mappedResults.map(r => {
      if (!r.isPublished) {
        return {
          _id: r._id,
          test: r.test,
          isPublished: false,
          submissionType: r.submissionType,
          violationCount: r.violationCount,
          submittedAt: r.createdAt,
          publishDate: r.publishDate,
        };
      }
      return r;
    });

    sendResponse(res, 200, true, 'Results retrieved successfully', safeResults);
  } catch (error) {
    next(error);
  }
};

/* ════════════════════════════
   STUDENT — get single result by ID
   Only accessible if published
════════════════════════════ */
export const getResultById = async (req, res, next) => {
  try {
    const result = await ExamAttempt.findById(req.params.id)
      .populate('subject', 'name slug description')
      .populate('responses.mcq', 'question options correctOptionIndex explanation')
      .lean();

    if (!result) {
      return sendResponse(res, 404, false, 'Result not found');
    }

    // Map subject to test
    result.test = result.subject ? { title: `${result.subject.name} Exam`, description: result.subject.description } : { title: 'Subject Exam' };

    // Only admin or owner can view
    if (result.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return sendResponse(res, 403, false, 'Not authorized to view this result');
    }

    // Students cannot access unpublished results
    if (!result.isPublished && req.user.role !== 'admin') {
      return sendResponse(res, 403, false, 'Results have not been officially released yet');
    }

    sendResponse(res, 200, true, 'Result retrieved successfully', result);
  } catch (error) {
    next(error);
  }
};

/* ════════════════════════════
   ADMIN — view ALL results (with scores)
════════════════════════════ */
export const getAllResultsAdmin = async (req, res, next) => {
  try {
    const results = await ExamAttempt.find()
      .populate('user', 'name email')
      .populate('subject', 'name')
      .sort('-createdAt')
      .lean();

    const mappedResults = results.map(r => ({
      ...r,
      test: r.subject ? { title: `${r.subject.name} Exam` } : { title: 'Subject Exam' }
    }));

    sendResponse(res, 200, true, 'All results retrieved (admin)', mappedResults);
  } catch (error) {
    next(error);
  }
};

/* ════════════════════════════
   ADMIN — publish all results for a specific test
   Triggers Socket.io broadcast
════════════════════════════ */
export const publishTestResults = async (req, res, next) => {
  try {
    const { testId } = req.body;

    if (!testId) {
      return sendResponse(res, 400, false, 'testId is required');
    }

    await ExamAttempt.updateMany(
      { subject: testId, isPublished: false },
      { $set: { isPublished: true, publishDate: new Date() } }
    );

    // Recalculate ranks globally
    await recalculateRanks();

    // Broadcast real-time event to all connected students
    try {
      getIO().emit('results:published', {
        testId,
        message: 'Official results have been released! Check your score now.',
        publishedAt: new Date()
      });
      getIO().emit('leaderboardUpdate', { timestamp: new Date() });
    } catch (socketErr) {
      console.log('Socket emit failed:', socketErr.message);
    }

    sendResponse(res, 200, true, 'Results published successfully and students notified');
  } catch (error) {
    next(error);
  }
};

/* ════════════════════════════
   ADMIN — publish ALL results globally
════════════════════════════ */
export const publishAllResults = async (req, res, next) => {
  try {
    await ExamAttempt.updateMany(
      { isPublished: false },
      { $set: { isPublished: true, publishDate: new Date() } }
    );

    await recalculateRanks();

    try {
      getIO().emit('results:published', {
        message: 'All official results have been released!',
        publishedAt: new Date()
      });
      getIO().emit('leaderboardUpdate', { timestamp: new Date() });
    } catch (socketErr) {
      console.log('Socket emit failed:', socketErr.message);
    }

    sendResponse(res, 200, true, 'All results published and students notified');
  } catch (error) {
    next(error);
  }
};

/* ════════════════════════════
   ADMIN — schedule result release date
════════════════════════════ */
export const scheduleResultRelease = async (req, res, next) => {
  try {
    const { testId, publishDate } = req.body;

    if (!publishDate) {
      return sendResponse(res, 400, false, 'publishDate is required');
    }

    const query = testId ? { subject: testId } : {};
    await ExamAttempt.updateMany(query, { $set: { publishDate: new Date(publishDate) } });

    sendResponse(res, 200, true, `Results scheduled for release on ${publishDate}`);
  } catch (error) {
    next(error);
  }
};

/* ════════════════════════════
   SYSTEM — auto-publish results whose publishDate has passed
   Called by a cron-like check in the server
════════════════════════════ */
export const autoPublishDueResults = async () => {
  try {
    const now = new Date();
    const due = await ExamAttempt.find({
      isPublished: false,
      publishDate: { $lte: now, $ne: null }
    });

    if (due.length === 0) return;

    await ExamAttempt.updateMany(
      { isPublished: false, publishDate: { $lte: now, $ne: null } },
      { $set: { isPublished: true } }
    );

    await recalculateRanks();

    try {
      getIO().emit('results:published', {
        message: 'Scheduled results have been automatically released!',
        publishedAt: now,
        count: due.length
      });
      getIO().emit('leaderboardUpdate', { timestamp: now });
    } catch { /* ignore */ }

    console.log(`[AutoPublish] Published ${due.length} scheduled results`);
  } catch (err) {
    console.error('[AutoPublish] Error:', err.message);
  }
};

/* ════════════════════════════
   STUDENT / SYSTEM — get latest published status for polling fallback
   Used by Vercel frontend to replace Socket.io reconnect loops
════════════════════════════ */
export const getLatestStatus = async (req, res, next) => {
  try {
    const latestPublished = await ExamAttempt.findOne({ isPublished: true })
      .sort({ publishDate: -1, updatedAt: -1 })
      .select('publishDate updatedAt')
      .lean();

    const publishedCount = await ExamAttempt.countDocuments({ isPublished: true, attemptStatus: 'completed' });

    sendResponse(res, 200, true, 'Latest status retrieved', {
      lastPublishedAt: latestPublished ? (latestPublished.publishDate || latestPublished.updatedAt) : null,
      publishedCount
    });
  } catch (error) {
    next(error);
  }
};
