import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import { sendResponse } from '../utils/response.js';
import { generateRollNumber } from '../utils/rollNumberGenerator.js';

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
