import mongoose from 'mongoose';

const mockEmailSchema = new mongoose.Schema({
  to: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  html: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 3600 // Expire after 1 hour to keep DB clean
  }
}, {
  timestamps: true
});

export default mongoose.model('MockEmail', mockEmailSchema);
