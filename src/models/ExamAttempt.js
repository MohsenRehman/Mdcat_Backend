import mongoose from 'mongoose';

const examAttemptSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  subject: {
    type: mongoose.Schema.ObjectId,
    ref: 'Subject',
    required: true
  },
  attemptNumber: { type: Number, default: 1, max: 1 },
  attemptStatus: { type: String, enum: ['in_progress', 'completed', 'expired'], default: 'in_progress' },
  isFreeTrial: { type: Boolean, default: false },
  responses: [{
    mcq: { type: mongoose.Schema.ObjectId, ref: 'Mcq' },
    selectedOptionIndex: { type: Number, default: -1 },
    isCorrect: { type: Boolean, default: false },
    timeSpent: { type: Number, default: 0 }
  }],
  score: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
  totalQuestions: { type: Number, default: 0 },
  correctAnswers: { type: Number, default: 0 },
  incorrectAnswers: { type: Number, default: 0 },
  skippedQuestions: { type: Number, default: 0 },
  timeTaken: { type: Number, default: 0 }, // seconds
  difficultyDistribution: {
    easy:   { type: Number, default: 0 },
    medium: { type: Number, default: 0 },
    hard:   { type: Number, default: 0 }
  },

  // --- Legacy Compatibility Fields ---
  wrongAnswers: { type: Number, default: 0 },
  unattempted:  { type: Number, default: 0 },
  totalMarks:   { type: Number, default: 0 },

  // --- Anti-cheating metadata ---
  violationCount: { type: Number, default: 0 },
  submissionType: { type: String, enum: ['manual', 'auto', 'forced'], default: 'manual' },
  violations: [{
    violationType: { type: String, enum: ['tab_switch', 'fullscreen_exit', 'copy_paste', 'right_click', 'window_blur'] },
    timestamp: { type: Date, default: Date.now }
  }],

  // --- Result release system ---
  isPublished: { type: Boolean, default: false },
  publishDate: { type: Date, default: null },
  rank:        { type: Number, default: null },
  percentile:  { type: Number, default: null }
}, {
  timestamps: true
});

examAttemptSchema.index({ user: 1, subject: 1 }, { unique: true });
examAttemptSchema.index({ percentage: -1 });

export default mongoose.model('ExamAttempt', examAttemptSchema);
