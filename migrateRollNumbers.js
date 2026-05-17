import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';
import { generateRollNumber } from './src/utils/rollNumberGenerator.js';

dotenv.config();

const migrate = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected.');

    const usersWithoutRollNumber = await User.find({ rollNumber: { $exists: false } });
    console.log(`Found ${usersWithoutRollNumber.length} users without a roll number.`);

    for (const user of usersWithoutRollNumber) {
      const { rollNumber, registrationYear } = await generateRollNumber();
      user.rollNumber = rollNumber;
      user.registrationYear = registrationYear;
      await user.save();
      console.log(`Assigned ${rollNumber} to ${user.name}`);
    }

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrate();
