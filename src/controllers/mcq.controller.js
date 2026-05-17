import Mcq from '../models/Mcq.js';
import Subject from '../models/Subject.js';
import { sendResponse } from '../utils/response.js';

import mongoose from 'mongoose';

// ─── Helper: resolve subject name → ObjectId ────────────────────────────────
const resolveSubjectId = async (subjectValue) => {
  if (!subjectValue) return null;
  if (/^[a-f\d]{24}$/i.test(subjectValue)) return new mongoose.Types.ObjectId(subjectValue);
  const subject = await Subject.findOne({ name: new RegExp(`^${subjectValue}$`, 'i') });
  return subject?._id || null;
};

/**
 * @desc    Get MCQs with pagination, search, and advanced filtering
 * @route   GET /api/mcqs
 * @access  Protected
 */
export const getMcqs = async (req, res, next) => {
  try {
    // Self-healing migration: convert any string subject fields in MongoDB to ObjectId
    const stringMcqs = await Mcq.find({ subject: { $type: 'string' } }).lean();
    if (stringMcqs.length > 0) {
      for (const m of stringMcqs) {
        if (/^[a-f\d]{24}$/i.test(m.subject)) {
          await Mcq.updateOne({ _id: m._id }, { $set: { subject: new mongoose.Types.ObjectId(m.subject) } });
        }
      }
    }

    const {
      subject,
      chapter,
      difficulty,
      status,
      search,
      page = 1,
      limit = 20
    } = req.query;

    const query = {};

    if (subject) {
      const subjectId = await resolveSubjectId(subject);
      if (subjectId) query.subject = subjectId;
    }
    if (chapter) query.chapter = new RegExp(chapter, 'i');
    if (difficulty) query.difficulty = difficulty;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { question: new RegExp(search, 'i') },
        { chapter: new RegExp(search, 'i') },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [mcqs, total] = await Promise.all([
      Mcq.find(query)
        .populate('subject', 'name slug')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Mcq.countDocuments(query)
    ]);

    sendResponse(res, 200, true, 'MCQs retrieved', {
      mcqs,
      pagination: {
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
        limit: limitNum
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get distinct chapter list (for filter dropdowns)
 * @route   GET /api/mcqs/taxonomy
 * @access  Protected
 */
export const getTaxonomy = async (req, res, next) => {
  try {
    const taxonomy = await Mcq.aggregate([
      {
        $group: {
          _id: { subject: '$subject', chapter: '$chapter' },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.subject',
          chapters: {
            $push: { name: '$_id.chapter', count: '$count' }
          },
          totalMcqs: { $sum: '$count' }
        }
      },
      {
        $lookup: {
          from: 'subjects',
          localField: '_id',
          foreignField: '_id',
          as: 'subjectDoc'
        }
      },
      { $unwind: { path: '$subjectDoc', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          subject: { $ifNull: ['$subjectDoc.name', 'Unknown'] },
          subjectSlug: { $ifNull: ['$subjectDoc.slug', ''] },
          chapters: 1,
          totalMcqs: 1
        }
      },
      { $sort: { subject: 1 } }
    ]);

    sendResponse(res, 200, true, 'Taxonomy retrieved', taxonomy);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single MCQ by ID
 * @route   GET /api/mcqs/:id
 * @access  Protected
 */
export const getMcq = async (req, res, next) => {
  try {
    const mcq = await Mcq.findById(req.params.id).populate('subject', 'name slug').populate('createdBy', 'name email');
    if (!mcq) return sendResponse(res, 404, false, 'MCQ not found');
    sendResponse(res, 200, true, 'MCQ retrieved', mcq);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a single MCQ with duplicate checking & createdBy tracking
 * @route   POST /api/mcqs
 * @access  Admin
 */
export const createMcq = async (req, res, next) => {
  try {
    const body = { ...req.body };

    const subjectId = await resolveSubjectId(body.subject);
    if (!subjectId) return sendResponse(res, 400, false, 'Invalid subject — must be Biology, Chemistry, Physics, or Mathematics');
    body.subject = subjectId;
    body.createdBy = req.user._id;

    // Check for exact duplicate question text
    const existing = await Mcq.findOne({ question: new RegExp(`^${body.question.trim()}$`, 'i'), subject: subjectId });
    if (existing) {
      return sendResponse(res, 400, false, 'An MCQ with this exact question text already exists in this subject.');
    }

    const mcq = await Mcq.create(body);
    const populated = await mcq.populate('subject', 'name slug');
    sendResponse(res, 201, true, 'MCQ created successfully', populated);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update MCQ with strict published locking guard
 * @route   PUT /api/mcqs/:id
 * @access  Admin
 */
export const updateMcq = async (req, res, next) => {
  try {
    const body = { ...req.body };

    const existingMcq = await Mcq.findById(req.params.id);
    if (!existingMcq) return sendResponse(res, 404, false, 'MCQ not found');

    // Strict Guard: If already published, prevent editing content unless reverting status
    if (existingMcq.status === 'published' && body.status === 'published') {
      // Check if any content fields are being modified
      const isModifyingContent = body.question || body.options || body.correctOptionIndex !== undefined || body.explanation;
      if (isModifyingContent) {
        return sendResponse(res, 400, false, 'Published MCQs are locked and cannot be edited. Please revert status to draft or reviewed first.');
      }
    }

    if (body.subject) {
      const subjectId = await resolveSubjectId(body.subject);
      if (!subjectId) return sendResponse(res, 400, false, 'Invalid subject');
      body.subject = subjectId;
    }

    const mcq = await Mcq.findByIdAndUpdate(req.params.id, body, {
      new: true,
      runValidators: true
    }).populate('subject', 'name slug');

    sendResponse(res, 200, true, 'MCQ updated successfully', mcq);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete MCQ
 * @route   DELETE /api/mcqs/:id
 * @access  Admin
 */
export const deleteMcq = async (req, res, next) => {
  try {
    const mcq = await Mcq.findByIdAndDelete(req.params.id);
    if (!mcq) return sendResponse(res, 404, false, 'MCQ not found');
    sendResponse(res, 200, true, 'MCQ deleted successfully', {});
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cycle MCQ status lifecycle (draft → reviewed → published → archived → draft)
 * @route   PATCH /api/mcqs/:id/toggle-status
 * @access  Admin
 */
export const toggleMcqStatus = async (req, res, next) => {
  try {
    const mcq = await Mcq.findById(req.params.id);
    if (!mcq) return sendResponse(res, 404, false, 'MCQ not found');

    const cycle = {
      draft: 'reviewed',
      reviewed: 'published',
      published: 'archived',
      archived: 'draft',
      active: 'published',
      inactive: 'archived'
    };

    mcq.status = cycle[mcq.status] || 'draft';
    await mcq.save();
    sendResponse(res, 200, true, `MCQ status changed to ${mcq.status}`, { status: mcq.status });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Bulk upload MCQs from JSON array with createdBy tracking
 * @route   POST /api/mcqs/bulk
 * @access  Admin
 */
export const bulkUploadMcqs = async (req, res, next) => {
  try {
    const { mcqs } = req.body;

    if (!Array.isArray(mcqs) || mcqs.length === 0) {
      return sendResponse(res, 400, false, 'Provide an array of MCQs in the "mcqs" field');
    }
    if (mcqs.length > 500) {
      return sendResponse(res, 400, false, 'Maximum 500 MCQs per bulk upload');
    }

    const subjectNames = [...new Set(mcqs.map(m => m.subject).filter(Boolean))];
    const subjectDocs = await Subject.find({
      name: { $in: subjectNames.map(n => new RegExp(`^${n}$`, 'i')) }
    });
    const subjectMap = {};
    subjectDocs.forEach(s => { subjectMap[s.name.toLowerCase()] = s._id; });

    const valid = [];
    const errors = [];

    mcqs.forEach((m, idx) => {
      const subId = subjectMap[m.subject?.toLowerCase()];
      if (!subId) {
        errors.push({ index: idx, reason: `Invalid subject: "${m.subject}"` });
        return;
      }
      if (!m.question || !Array.isArray(m.options) || m.options.length !== 4) {
        errors.push({ index: idx, reason: 'question and exactly 4 options are required' });
        return;
      }
      valid.push({ ...m, subject: subId, createdBy: req.user._id, status: m.status || 'draft' });
    });

    let inserted = [];
    if (valid.length > 0) {
      inserted = await Mcq.insertMany(valid, { ordered: false });
    }

    sendResponse(res, 201, true, `Bulk upload complete`, {
      inserted: inserted.length,
      failed: errors.length,
      errors
    });
  } catch (error) {
    next(error);
  }
};
