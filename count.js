import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Test from './src/models/Test.js';
import Mcq from './src/models/Mcq.js';

dotenv.config();

const count = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const tests = await Test.countDocuments();
  const mcqs = await Mcq.countDocuments();
  console.log(`Tests: ${tests}`);
  console.log(`MCQs: ${mcqs}`);
  process.exit(0);
};

count();
