import { sendResponse } from '../utils/response.js';

// In-memory store for rate limiting: IP -> { count, startTime }
const rateLimitStore = new Map();

/**
 * @desc Rate limiter middleware for admin login routes
 *       Allows max 5 attempts per 15 minutes per IP
 */
export const adminLoginRateLimiter = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const currentTime = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 5;

  if (!rateLimitStore.has(ip)) {
    rateLimitStore.set(ip, { count: 1, startTime: currentTime });
    return next();
  }

  const record = rateLimitStore.get(ip);

  // If window has elapsed, reset count
  if (currentTime - record.startTime > windowMs) {
    rateLimitStore.set(ip, { count: 1, startTime: currentTime });
    return next();
  }

  // If within window, increment count
  record.count += 1;
  rateLimitStore.set(ip, record);

  if (record.count > maxAttempts) {
    return sendResponse(
      res,
      429,
      false,
      'Too many admin login attempts from this IP, please try again after 15 minutes'
    );
  }

  next();
};
