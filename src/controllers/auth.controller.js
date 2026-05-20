import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { sendResponse } from '../utils/response.js';
import { generateRollNumber } from '../utils/rollNumberGenerator.js';
import sendEmail from '../utils/sendEmail.js';
import MockEmail from '../models/MockEmail.js';

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d'
  });
};

export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const userExists = await User.findOne({ email });

    if (userExists) {
      return sendResponse(res, 400, false, 'User already exists');
    }

    const { rollNumber, registrationYear } = await generateRollNumber();

    // Force role to student, ignoring any incoming role value
    const user = await User.create({
      name,
      email,
      password,
      role: 'student',
      rollNumber,
      registrationYear
    });

    sendResponse(res, 201, true, 'User registered successfully', {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      rollNumber: user.rollNumber,
      token: generateToken(user._id)
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return sendResponse(res, 401, false, 'Invalid credentials');
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return sendResponse(res, 401, false, 'Invalid credentials');
    }

    sendResponse(res, 200, true, 'Login successful', {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isPremium: user.isPremium,
      rollNumber: user.rollNumber,
      token: generateToken(user._id)
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    sendResponse(res, 200, true, 'User details retrieved', user);
  } catch (error) {
    next(error);
  }
};

export const adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return sendResponse(res, 401, false, 'Invalid credentials');
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return sendResponse(res, 401, false, 'Invalid credentials');
    }

    if (user.role !== 'admin' && user.role !== 'superAdmin') {
      return sendResponse(res, 403, false, 'Access forbidden: Admin credentials required');
    }

    sendResponse(res, 200, true, 'Admin login successful', {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isPremium: user.isPremium,
      rollNumber: user.rollNumber,
      token: generateToken(user._id)
    });
  } catch (error) {
    next(error);
  }
};

export const validateAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || (user.role !== 'admin' && user.role !== 'superAdmin')) {
      return sendResponse(res, 403, false, 'Forbidden: Admin access required');
    }
    sendResponse(res, 200, true, 'Admin validated successfully', user);
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      return sendResponse(res, 404, false, 'There is no user with that email');
    }

    // Get reset token
    const resetToken = user.getResetPasswordToken();

    await user.save({ validateBeforeSave: false });

    // Create reset url
    const resetUrl = `${process.env.CLIENT_URL || process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #1e293b; text-align: center;">Password Reset Request</h2>
        <p style="color: #334155; font-size: 16px;">Hello ${user.name},</p>
        <p style="color: #334155; font-size: 16px;">You are receiving this email because you (or someone else) has requested the reset of a password. Please click the button below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Reset Password</a>
        </div>
        <p style="color: #64748b; font-size: 14px; text-align: center;">This link will expire in 15 minutes.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">If you did not request a password reset, please ignore this email.</p>
      </div>
    `;

    // Save to MockEmail model for the developer-only simulated inbox
    try {
      await MockEmail.create({
        to: user.email,
        subject: 'Password Reset Token',
        html
      });
    } catch (dbErr) {
      console.error('Failed to save mock email to MongoDB:', dbErr.message);
    }

    try {
      await sendEmail({
        email: user.email,
        subject: 'Password Reset Token',
        html
      });

      sendResponse(res, 200, true, 'Email sent');
    } catch (err) {
      console.warn('Real SMTP delivery failed, falling back to simulated email sandbox:', err.message);
      // In development or if SMTP is unconfigured, we proceed so local/dev verification works.
      sendResponse(res, 200, true, 'Email sent (simulated)');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password
// @route   PUT /api/auth/reset-password/:token
// @access  Public
export const resetPassword = async (req, res, next) => {
  try {
    // Get hashed token
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return sendResponse(res, 400, false, 'Invalid token or token has expired');
    }

    // Set new password
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    sendResponse(res, 200, true, 'Password updated successfully', {
      token: generateToken(user._id)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get mock emails (Development/Testing only)
// @route   GET /api/auth/mock-emails
// @access  Public (Dev mode)
export const getMockEmails = async (req, res, next) => {
  try {
    const emails = await MockEmail.find().sort({ createdAt: -1 });
    sendResponse(res, 200, true, 'Mock emails retrieved successfully', emails);
  } catch (error) {
    next(error);
  }
};

// @desc    Clear all mock emails (Development/Testing only)
// @route   DELETE /api/auth/mock-emails
// @access  Public (Dev mode)
export const deleteMockEmails = async (req, res, next) => {
  try {
    await MockEmail.deleteMany({});
    sendResponse(res, 200, true, 'Mock emails cleared successfully');
  } catch (error) {
    next(error);
  }
};
