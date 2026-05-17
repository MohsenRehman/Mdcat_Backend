import { sendResponse } from '../utils/response.js';

export const checkPremium = (req, res, next) => {
  if (req.user.role === 'admin') {
    return next();
  }

  if (!req.user.isPremium) {
    return sendResponse(res, 403, false, 'This resource requires a premium subscription');
  }

  // Check if premium has expired
  if (req.user.premiumExpiry && new Date() > new Date(req.user.premiumExpiry)) {
    return sendResponse(res, 403, false, 'Your premium subscription has expired');
  }

  next();
};
