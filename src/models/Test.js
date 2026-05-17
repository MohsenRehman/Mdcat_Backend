import mongoose from 'mongoose';

const testSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a test title']
  },
  description: {
    type: String,
    default: ''
  },
  mcqs: [{
    type: mongoose.Schema.ObjectId,
    ref: 'Mcq'
  }],
  duration: {
    type: Number, // duration in minutes
    required: [true, 'Please specify test duration in minutes']
  },
  isRandomized: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

export default mongoose.model('Test', testSchema);
