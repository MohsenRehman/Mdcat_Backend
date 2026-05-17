import User from '../models/User.js';
import Subject from '../models/Subject.js';
import Mcq from '../models/Mcq.js';
import ExamAttempt from '../models/ExamAttempt.js';
import { sendResponse } from '../utils/response.js';

export const getDashboardStats = async (req, res, next) => {
  try {
    const [totalUsers, premiumUsers, totalMcqs, subjects] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'student', isPremium: true }),
      Mcq.countDocuments({ status: { $in: ['active', 'published'] } }),
      Subject.find({ isActive: true }).lean()
    ]);

    // Per-subject MCQ counts
    const subjectStats = await Mcq.aggregate([
      { $group: { _id: '$subject', total: { $sum: 1 }, active: { $sum: { $cond: [{ $in: ['$status', ['active', 'published']] }, 1, 0] } } } }
    ]);
    const subjectMap = {};
    subjectStats.forEach(s => { subjectMap[s._id.toString()] = s; });

    const subjectBreakdown = subjects.map(s => ({
      name: s.name,
      slug: s.slug,
      total: subjectMap[s._id.toString()]?.total || 0,
      active: subjectMap[s._id.toString()]?.active || 0
    }));

    // Overall performance from ExamAttempts
    const overallStats = await ExamAttempt.aggregate([
      { $group: { _id: null, avgPercentage: { $avg: '$percentage' }, totalAttempts: { $sum: 1 } } }
    ]);

    // Top 5 performers
    const topPerformers = await ExamAttempt.aggregate([
      { $group: { _id: '$user', averagePercentage: { $avg: '$percentage' }, testsAttempted: { $sum: 1 } } },
      { $sort: { averagePercentage: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { name: '$user.name', email: '$user.email', averagePercentage: 1, testsAttempted: 1 } }
    ]);

    sendResponse(res, 200, true, 'Dashboard analytics retrieved', {
      totalUsers,
      premiumUsers,
      totalMcqs,         // replaces totalTests — shows active MCQ count
      subjectBreakdown,
      overallPerformance: overallStats[0] || { avgPercentage: 0, totalAttempts: 0 },
      topPerformers
    });
  } catch (error) {
    next(error);
  }
};

export const getStudentDashboardStats = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // 1. Total available active subjects
    const totalAvailableTests = await Subject.countDocuments({ isActive: true });

    // 2. Fetch all exam attempts for this specific user
    const userAttempts = await ExamAttempt.find({ user: userId }).populate('subject', 'name');

    // Only count attempts that have been officially completed/submitted
    const completedAttempts = userAttempts.filter(a => a.attemptStatus === 'completed');
    const attemptedTests = completedAttempts.length;
    
    // 3. Calculate Average Score (ONLY from published attempts) & Time Spent (from completed attempts)
    let totalPercentage = 0;
    let totalSeconds = 0;
    let publishedCount = 0;

    userAttempts.forEach(a => {
      if (a.attemptStatus === 'completed') {
        totalSeconds += (a.timeTaken || 0);
      }
      if (a.isPublished) {
        totalPercentage += (a.percentage || 0);
        publishedCount += 1;
      }
    });

    const averageScore = publishedCount > 0 ? (totalPercentage / publishedCount) : 0;
    
    // Convert seconds to hours and minutes string
    const totalMinutes = Math.floor(totalSeconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const totalTimeSpent = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

    // 4. Get recent activity for charts (ONLY published attempts)
    const recentActivity = await ExamAttempt.find({ user: userId, isPublished: true })
      .sort({ createdAt: 1 }) // Chronological order for chart trend
      .populate('subject', 'name')
      .limit(10);

    const formattedActivity = recentActivity.map(a => ({
      testName: a.subject ? a.subject.name : 'Subject Exam',
      score: a.percentage || 0,
      date: a.createdAt
    }));

    const data = {
      totalAvailableTests,
      attemptedTests,
      averageScore,
      totalTimeSpent,
      recentActivity: formattedActivity
    };

    sendResponse(res, 200, true, 'Student dashboard stats retrieved', data);
  } catch (error) {
    next(error);
  }
};

