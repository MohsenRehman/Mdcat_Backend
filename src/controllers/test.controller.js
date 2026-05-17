import Test from '../models/Test.js';
import Mcq from '../models/Mcq.js';
import Result from '../models/Result.js';
import { sendResponse } from '../utils/response.js';
import { calculateScore } from '../utils/scoreCalculator.js';
import { getIO } from '../sockets/index.js';

export const getTests = async (req, res, next) => {
  try {
    const tests = await Test.find({ isActive: true }).populate('createdBy', 'name');
    sendResponse(res, 200, true, 'Tests retrieved successfully', tests);
  } catch (error) {
    next(error);
  }
};

export const getTest = async (req, res, next) => {
  try {
    const test = await Test.findById(req.params.id).populate('mcqs', '-correctOptionIndex -explanation');
    
    if (!test) {
      return sendResponse(res, 404, false, 'Test not found');
    }

    if (test.isRandomized) {
      test.mcqs = test.mcqs.sort(() => 0.5 - Math.random());
    }

    sendResponse(res, 200, true, 'Test retrieved successfully', test);
  } catch (error) {
    next(error);
  }
};

export const createTest = async (req, res, next) => {
  try {
    req.body.createdBy = req.user.id;
    const test = await Test.create(req.body);
    sendResponse(res, 201, true, 'Test created successfully', test);
  } catch (error) {
    next(error);
  }
};

export const updateTest = async (req, res, next) => {
  try {
    let test = await Test.findById(req.params.id);
    if (!test) {
      return sendResponse(res, 404, false, 'Test not found');
    }

    test = await Test.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    sendResponse(res, 200, true, 'Test updated successfully', test);
  } catch (error) {
    next(error);
  }
};

export const generatePracticeTest = async (req, res, next) => {
  try {
    const { subject, chapter, limit = 20 } = req.body;

    if (!subject) {
      return sendResponse(res, 400, false, 'Subject is required to generate practice test');
    }

    const query = { subject };
    if (chapter) query.chapter = chapter;

    // Find random MCQs for this subject/chapter
    const mcqs = await Mcq.aggregate([
      { $match: query },
      { $sample: { size: Number(limit) } }
    ]);

    if (!mcqs || mcqs.length === 0) {
      return sendResponse(res, 404, false, 'No MCQs found for this selection');
    }

    const mcqIds = mcqs.map(m => m._id);
    const title = `Practice: ${subject}${chapter ? ` - ${chapter}` : ''}`;

    const test = await Test.create({
      title,
      description: 'Auto-generated practice session',
      duration: mcqs.length * 1, // 1 minute per question
      isActive: false, // Don't show in global tests list
      isRandomized: true,
      mcqs: mcqIds,
      createdBy: req.user._id
    });

    sendResponse(res, 201, true, 'Practice test generated successfully', test);
  } catch (error) {
    next(error);
  }
};

export const submitTest = async (req, res, next) => {
  try {
    const { responses, violationCount = 0, submissionType = 'manual' } = req.body;
    const testId = req.params.id;

    const test = await Test.findById(testId).populate('mcqs');
    if (!test) {
      return sendResponse(res, 404, false, 'Test not found');
    }

    // Check if user already attempted
    const existingResult = await Result.findOne({ user: req.user._id, test: testId });
    if (existingResult) {
      return sendResponse(res, 400, false, 'You have already attempted this test');
    }

    // Calculate Score
    const scoreData = calculateScore(responses, test.mcqs);

    // Save Result — locked by default until admin publishes
    const result = await Result.create({
      user: req.user._id,
      test: testId,
      isPublished: false,
      violationCount,
      submissionType,
      ...scoreData
    });

    // Emit live leaderboard update
    try {
      getIO().emit('new-result', {
        user: req.user.name,
        test: test.title,
        score: scoreData.score,
        percentage: scoreData.percentage
      });
    } catch (socketErr) {
      console.log('Socket emission failed, ignoring...', socketErr.message);
    }

    sendResponse(res, 201, true, 'Test submitted successfully', result);
  } catch (error) {
    next(error);
  }
};
