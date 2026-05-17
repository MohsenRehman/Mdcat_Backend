import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { sendResponse } from '../utils/response.js';

/**
 * @desc Enhanced authentication middleware supporting TokenExpiredError handling
 *       Returns 401 Unauthorized for invalid/expired tokens
 */
export const authMiddleware = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return sendResponse(res, 401, false, 'Unauthorized: No token provided');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);

    if (!req.user) {
      return sendResponse(res, 401, false, 'Unauthorized: User no longer exists');
    }

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return sendResponse(res, 401, false, 'Unauthorized: Token expired. Please log in again.');
    }
    return sendResponse(res, 401, false, 'Unauthorized: Invalid token');
  }
};

/**
 * @desc Middleware to restrict access to admin and superAdmin roles only
 *       Returns 403 Forbidden for unauthorized roles
 */
export const adminOnly = (req, res, next) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'superAdmin')) {
    return sendResponse(res, 403, false, 'Forbidden: Admin access required');
  }
  next();
};

/**
 * @desc Middleware to restrict access to superAdmin role only
 *       Returns 403 Forbidden for unauthorized roles
 */
export const superAdminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'superAdmin') {
    return sendResponse(res, 403, false, 'Forbidden: Super Admin access required');
  }
  next();
};
