import User from '../models/User.js';
import { sendResponse } from '../utils/response.js';

export const getUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';

    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { rollNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const totalUsers = await User.countDocuments(query);
    const users = await User.find(query)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    sendResponse(res, 200, true, 'Users retrieved successfully', {
      users,
      pagination: {
        page,
        limit,
        totalUsers,
        totalPages: Math.ceil(totalUsers / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return sendResponse(res, 404, false, 'User not found');
    }
    sendResponse(res, 200, true, 'User retrieved successfully', user);
  } catch (error) {
    next(error);
  }
};

export const getUserByRollNumber = async (req, res, next) => {
  try {
    const { rollNumber } = req.params;
    const user = await User.findOne({ rollNumber });
    if (!user) {
      return sendResponse(res, 404, false, 'User not found');
    }
    sendResponse(res, 200, true, 'User retrieved successfully', user);
  } catch (error) {
    next(error);
  }
};
