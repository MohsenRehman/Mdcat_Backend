import mongoose from 'mongoose';

const mcqSchema = new mongoose.Schema({
  question: {
    type: String,
    required: [true, 'Please add a question text'],
    trim: true
  },
  options: {
    type: [String],
    required: [true, 'Please provide options'],
    validate: [arrayLimit, '{PATH} must have exactly 4 options']
  },
  correctOptionIndex: {
    type: Number,
    required: [true, 'Please specify the index of the correct option (0-3)'],
    min: 0,
    max: 3
  },
  // Uses ObjectId ref to Subject
  subject: {
    type: mongoose.Schema.ObjectId,
    ref: 'Subject',
    required: [true, 'Please specify a subject']
  },
  chapter: {
    type: String,
    required: [true, 'Please specify the chapter'],
    trim: true
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  explanation: {
    type: String,
    default: 'No explanation provided.'
  },
  tags: {
    type: [String],
    default: []
  },
  status: {
    type: String,
    enum: ['draft', 'reviewed', 'published', 'archived', 'active', 'inactive'],
    default: 'draft'
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Compound index for fast subject+difficulty queries
mcqSchema.index({ subject: 1, difficulty: 1, status: 1 });
mcqSchema.index({ subject: 1, chapter: 1 });

function arrayLimit(val) {
  return val.length === 4;
}

export default mongoose.model('Mcq', mcqSchema);
