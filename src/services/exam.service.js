import Mcq from '../models/Mcq.js';
import Subject from '../models/Subject.js';
import ExamAttempt from '../models/ExamAttempt.js';

export class ExamService {
  /**
   * @desc    Start a new exam attempt or resume an existing in-progress attempt
   */
  static async getOrStartAttempt(user, subject, existingAttempt, limit = 75) {
    const isFreeUser = user.role !== 'admin' && !user.isPremium;

    if (existingAttempt) {
      // Resume existing in-progress attempt
      const mcqIds = existingAttempt.responses.map(r => r.mcq);
      const mcqs = await Mcq.find({ _id: { $in: mcqIds } }, { correctOptionIndex: 0, explanation: 0 }).lean();

      // Create a map for quick lookup
      const mcqMap = {};
      mcqs.forEach(m => { mcqMap[m._id.toString()] = m; });

      // Merge responses with mcq details
      const resumedMcqs = existingAttempt.responses.map(r => {
        const m = mcqMap[r.mcq.toString()];
        return m ? { ...m, selectedOptionIndex: r.selectedOptionIndex, timeSpent: r.timeSpent } : null;
      }).filter(Boolean);

      return {
        isResumed: true,
        attemptId: existingAttempt._id,
        subjectId: subject._id,
        subjectName: subject.name,
        subjectSlug: subject.slug,
        totalQuestions: resumedMcqs.length,
        estimatedDuration: resumedMcqs.length,
        timeTakenSoFar: existingAttempt.timeTaken || 0,
        isFreeTrial: existingAttempt.isFreeTrial || false,
        totalPremiumQuestions: limit,
        mcqs: resumedMcqs
      };
    }

    // Start a fresh attempt — fetch random published MCQs (match both ObjectId and String representation of subject)
    const allMcqs = await Mcq.aggregate([
      { $match: { subject: { $in: [subject._id, subject._id.toString()] }, status: { $in: ['published', 'active'] } } },
      { $sample: { size: limit } },
      { $project: { correctOptionIndex: 0, explanation: 0 } }
    ]);

    if (allMcqs.length === 0) {
      throw new Error(`No published MCQs found for ${subject.name}`);
    }

    const mcqs = isFreeUser ? allMcqs.slice(0, 3) : allMcqs;

    // Initialize responses array
    const initialResponses = mcqs.map(m => ({
      mcq: m._id,
      selectedOptionIndex: -1,
      isCorrect: false,
      timeSpent: 0
    }));

    // Create new in-progress attempt
    const newAttempt = await ExamAttempt.create({
      user: user._id,
      subject: subject._id,
      attemptNumber: 1,
      attemptStatus: 'in_progress',
      responses: initialResponses,
      totalQuestions: mcqs.length,
      isFreeTrial: isFreeUser,
      isPublished: false
    });

    return {
      isResumed: false,
      attemptId: newAttempt._id,
      subjectId: subject._id,
      subjectName: subject.name,
      subjectSlug: subject.slug,
      totalQuestions: mcqs.length,
      estimatedDuration: mcqs.length,
      timeTakenSoFar: 0,
      isFreeTrial: isFreeUser,
      totalPremiumQuestions: allMcqs.length,
      mcqs
    };
  }

  /**
   * @desc    Auto-save responses during an active exam session
   */
  static async autosaveAttempt(userId, subjectSlug, responses = [], timeTaken = 0) {
    const subject = await Subject.findOne({ slug: subjectSlug });
    if (!subject) throw new Error('Subject not found');

    const attempt = await ExamAttempt.findOne({
      user: userId,
      subject: subject._id,
      attemptStatus: 'in_progress'
    });

    if (!attempt) throw new Error('No active in-progress exam attempt found to autosave');

    // Update responses and timeTaken
    // Map existing responses to keep track of mcqs
    const respMap = {};
    responses.forEach(r => { respMap[r.mcqId || r.mcq] = r; });

    attempt.responses.forEach(r => {
      const updated = respMap[r.mcq.toString()];
      if (updated) {
        if (updated.selectedOptionIndex !== undefined) r.selectedOptionIndex = updated.selectedOptionIndex;
        if (updated.timeSpent !== undefined) r.timeSpent = updated.timeSpent;
      }
    });

    attempt.timeTaken = timeTaken;
    await attempt.save();

    return attempt;
  }

  /**
   * @desc    Evaluate and complete an exam attempt
   */
  static async submitAttempt(userId, subjectSlug, responses = [], timeTaken = 0, violationCount = 0, submissionType = 'manual') {
    const subject = await Subject.findOne({ slug: subjectSlug });
    if (!subject) throw new Error('Subject not found');

    const attempt = await ExamAttempt.findOne({
      user: userId,
      subject: subject._id,
      attemptStatus: 'in_progress'
    });

    if (!attempt) throw new Error('Exam already submitted or no active attempt found');

    const mcqIds = attempt.responses.map(r => r.mcq);
    const mcqDocs = await Mcq.find({ _id: { $in: mcqIds } });
    const mcqMap = {};
    mcqDocs.forEach(m => { mcqMap[m._id.toString()] = m; });

    let correct = 0;
    let incorrect = 0;
    let skipped = 0;
    const diffDist = { easy: 0, medium: 0, hard: 0 };

    // Create lookup from incoming responses
    const incomingMap = {};
    responses.forEach(r => { incomingMap[r.mcqId || r.mcq] = r; });

    attempt.responses.forEach(r => {
      const inc = incomingMap[r.mcq.toString()];
      const sel = inc && inc.selectedOptionIndex !== undefined ? inc.selectedOptionIndex : r.selectedOptionIndex;
      r.selectedOptionIndex = sel;

      const mcq = mcqMap[r.mcq.toString()];
      if (!mcq) return;

      const isSkipped = sel === -1 || sel === undefined;
      const isCorrect = !isSkipped && sel === mcq.correctOptionIndex;

      r.isCorrect = isCorrect;
      if (inc && inc.timeSpent) r.timeSpent = inc.timeSpent;

      if (isSkipped) skipped++;
      else if (isCorrect) { correct++; diffDist[mcq.difficulty || 'medium']++; }
      else incorrect++;
    });

    const total = attempt.responses.length;
    const percentage = total > 0 ? parseFloat(((correct / total) * 100).toFixed(2)) : 0;

    attempt.score = correct;
    attempt.percentage = percentage;
    attempt.correctAnswers = correct;
    attempt.incorrectAnswers = incorrect;
    attempt.skippedQuestions = skipped;
    attempt.wrongAnswers = incorrect;
    attempt.unattempted = skipped;
    attempt.totalMarks = total;
    attempt.timeTaken = timeTaken;
    attempt.difficultyDistribution = diffDist;
    attempt.violationCount = violationCount;
    attempt.submissionType = submissionType;
    attempt.attemptStatus = 'completed';
    attempt.isPublished = false; // Pending admin release

    await attempt.save();

    return { attempt, subject };
  }

  /**
   * @desc    Log security violation during active exam session (2-Strike Auto-Submit Rule)
   */
  static async logViolation(userId, subjectSlug, violationType) {
    const subject = await Subject.findOne({ slug: subjectSlug });
    if (!subject) throw new Error('Subject not found');

    const attempt = await ExamAttempt.findOne({
      user: userId,
      subject: subject._id,
      attemptStatus: 'in_progress'
    });

    if (!attempt) throw new Error('No active in-progress exam attempt found to log violation');

    attempt.violations.push({
      violationType,
      timestamp: new Date()
    });
    attempt.violationCount += 1;

    // Check 2-strike rule
    if (attempt.violationCount >= 2) {
      await attempt.save();
      const { attempt: submittedAttempt } = await this.submitAttempt(
        userId,
        subjectSlug,
        [], // keep existing responses already in db
        attempt.timeTaken || 0,
        attempt.violationCount,
        'forced'
      );
      return {
        autoSubmitted: true,
        warning: false,
        violationCount: submittedAttempt.violationCount,
        attemptId: submittedAttempt._id,
        subjectName: subject.name,
        message: 'Maximum violations reached (2/2 strikes). Exam has been automatically submitted and permanently locked.'
      };
    }

    await attempt.save();
    return {
      autoSubmitted: false,
      warning: true,
      violationCount: attempt.violationCount,
      message: 'Warning 1 of 2: Security violation detected. Tab switching, fullscreen exit, right-clicking, and copy/paste are strictly prohibited. Next violation will result in immediate automatic submission.'
    };
  }
}
