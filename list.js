import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Test from './src/models/Test.js';

dotenv.config();

const list = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const tests = await Test.find({}, 'title isActive');
  console.log(tests);
  process.exit(0);
};

list();
