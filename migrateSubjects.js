/**
 * Migration: Seed 4 canonical subjects & re-link all existing MCQs to Subject ObjectIds
 * Safe to re-run — uses upsert for subjects, skips MCQs already referencing an ObjectId.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import Subject from './src/models/Subject.js';
import Mcq from './src/models/Mcq.js';

const SUBJECTS = [
  { name: 'Biology',     slug: 'biology',     icon: 'Dna' },
  { name: 'Chemistry',   slug: 'chemistry',   icon: 'FlaskConical' },
  { name: 'Physics',     slug: 'physics',     icon: 'Atom' },
  { name: 'Mathematics', slug: 'mathematics', icon: 'Calculator' },
];

// Common name variants that may exist in old string-based subject field
const SUBJECT_ALIASES = {
  biology:     ['biology', 'bio'],
  chemistry:   ['chemistry', 'chem'],
  physics:     ['physics', 'phy'],
  mathematics: ['mathematics', 'math', 'maths'],
};

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // 1. Upsert the 4 canonical subjects
    const subjectMap = {};
    for (const s of SUBJECTS) {
      const doc = await Subject.findOneAndUpdate(
        { slug: s.slug },
        { $setOnInsert: s },
        { upsert: true, new: true }
      );
      subjectMap[s.slug] = doc._id;
      console.log(`  📚 Subject ready: ${s.name} (${doc._id})`);
    }

    // 2. Find all MCQs that still have a string subject (not an ObjectId)
    const allMcqs = await Mcq.find({}).lean();
    let updated = 0;
    let skipped = 0;
    let unmatched = 0;

    for (const mcq of allMcqs) {
      // If subject is already a valid ObjectId, skip
      if (mongoose.Types.ObjectId.isValid(mcq.subject) && typeof mcq.subject === 'object') {
        skipped++;
        continue;
      }

      const subjectStr = (mcq.subject || '').toString().toLowerCase().trim();
      let targetSlug = null;

      for (const [slug, aliases] of Object.entries(SUBJECT_ALIASES)) {
        if (aliases.some(alias => subjectStr.includes(alias))) {
          targetSlug = slug;
          break;
        }
      }

      if (!targetSlug) {
        console.warn(`  ⚠️  Could not map MCQ "${mcq._id}" subject="${mcq.subject}" — marking inactive`);
        await Mcq.findByIdAndUpdate(mcq._id, { status: 'inactive' });
        unmatched++;
        continue;
      }

      await Mcq.findByIdAndUpdate(mcq._id, {
        subject: subjectMap[targetSlug],
        status: mcq.status || 'active'
      });
      updated++;
    }

    console.log(`\n🎉 Migration Complete!`);
    console.log(`   Updated: ${updated} MCQs`);
    console.log(`   Skipped (already linked): ${skipped} MCQs`);
    console.log(`   Unmatched (set inactive): ${unmatched} MCQs`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
};

run();
