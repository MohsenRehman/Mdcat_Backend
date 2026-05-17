import ExamAttempt from '../models/ExamAttempt.js';
import { sendResponse } from '../utils/response.js';

export const getGlobalLeaderboard = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const search = req.query.search || '';

    // Check if there are any published results at all
    const publishedCount = await ExamAttempt.countDocuments({ isPublished: true, attemptStatus: 'completed' });

    if (publishedCount === 0) {
      // Return locked state — no published results yet
      return sendResponse(res, 200, true, 'Leaderboard is locked', {
        isLocked: true,
        entries: [],
        message: 'Official results have not been announced yet. The leaderboard will be activated once admin publishes results.'
      });
    }

    const matchStage = { isPublished: true, attemptStatus: 'completed' };

    const basePipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: '$user',
          totalScore:        { $sum: '$score' },
          totalTests:        { $sum: 1 },
          totalCorrect:      { $sum: '$correctAnswers' },
          totalWrong:        { $sum: '$incorrectAnswers' },
          averagePercentage: { $avg: '$percentage' },
          bestPercentage:    { $max: '$percentage' },
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' }
    ];

    if (search) {
      basePipeline.push({
        $match: {
          $or: [
            { 'user.name': { $regex: search, $options: 'i' } },
            { 'user.rollNumber': { $regex: search, $options: 'i' } }
          ]
        }
      });
    }

    // Pipeline to get total count for pagination
    const countPipeline = [...basePipeline, { $count: 'total' }];
    
    // Pipeline to get actual data
    const dataPipeline = [
      ...basePipeline,
      {
        $project: {
          _id: 1,
          name:              '$user.name',
          rollNumber:        '$user.rollNumber',
          totalScore:        1,
          totalTests:        1,
          totalCorrect:      1,
          totalWrong:        1,
          averagePercentage: 1,
          bestPercentage:    1
        }
      },
      { $sort: { averagePercentage: -1, totalScore: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit }
    ];

    const [countResult, leaderboard] = await Promise.all([
      ExamAttempt.aggregate(countPipeline),
      ExamAttempt.aggregate(dataPipeline)
    ]);

    const totalParticipants = countResult.length > 0 ? countResult[0].total : 0;
    const totalPages = Math.ceil(totalParticipants / limit);

    // Add global rank to each entry
    const ranked = leaderboard.map((entry, i) => {
      const globalRank = ((page - 1) * limit) + i + 1;
      return {
        ...entry,
        rank: globalRank,
        percentile: totalParticipants > 0 
          ? parseFloat(((totalParticipants - globalRank) / totalParticipants * 100).toFixed(1))
          : 0
      };
    });

    sendResponse(res, 200, true, 'Global leaderboard retrieved', {
      isLocked: false,
      entries: ranked,
      pagination: {
        page,
        limit,
        totalParticipants,
        totalPages
      }
    });
  } catch (error) {
    next(error);
  }
};
