import Counter from '../models/Counter.js';

export const generateRollNumber = async () => {
  const currentYear = new Date().getFullYear();

  // Find the counter for roll numbers and atomically increment it
  const counter = await Counter.findOneAndUpdate(
    { id: 'rollNumber' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  // Format the sequence with leading zeros (e.g., 0001, 0012)
  const sequenceStr = counter.seq.toString().padStart(4, '0');

  // Format: MDCATYYYY-SEQ
  return {
    rollNumber: `MDCAT${currentYear}-${sequenceStr}`,
    registrationYear: currentYear
  };
};
