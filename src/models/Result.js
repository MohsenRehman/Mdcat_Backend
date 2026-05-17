import mongoose from 'mongoose';

const resultSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  test: {
    type: mongoose.Schema.ObjectId,
    ref: 'Test',
    required: true
  },
  responses: [{
    mcq: {
      type: mongoose.Schema.ObjectId,
      ref: 'Mcq'
    },
    selectedOptionIndex: {
      type: Number,
      default: -1
    },
    isCorrect: Boolean
  }],
  correctAnswers: { type: Number, required: true },
  wrongAnswers:   { type: Number, required: true },
  unattempted:    { type: Number, required: true },
  totalMarks:     { type: Number, required: true },
  score:          { type: Number, required: true },
  percentage:     { type: Number, required: true },

  // --- Anti-cheating metadata ---
  violationCount:  { type: Number, default: 0 },
  submissionType:  { type: String, enum: ['manual', 'auto', 'forced'], default: 'manual' },

  // --- Result release system ---
  isPublished:  { type: Boolean, default: false },
  publishDate:  { type: Date,    default: null },
  rank:         { type: Number,  default: null },
  percentile:   { type: Number,  default: null },

}, { timestamps: true });

// One attempt per user per test
resultSchema.index({ user: 1, test: 1 }, { unique: true });

export default mongoose.model('Result', resultSchema);
