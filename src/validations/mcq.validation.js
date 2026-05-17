import { body, validationResult } from 'express-validator';
import { sendResponse } from '../utils/response.js';

export const validateMcqCreate = [
  body('question').notEmpty().withMessage('Question text is required'),
  body('options').isArray({ min: 4, max: 4 }).withMessage('Exactly 4 options are required'),
  body('correctOptionIndex').isInt({ min: 0, max: 3 }).withMessage('Correct option index must be between 0 and 3'),
  body('subject').notEmpty().withMessage('Subject is required'),
  body('chapter').notEmpty().withMessage('Chapter is required'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendResponse(res, 400, false, 'Validation Error', errors.array());
    }
    next();
  }
];
