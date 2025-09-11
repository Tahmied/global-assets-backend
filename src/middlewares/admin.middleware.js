import jwt from 'jsonwebtoken';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const requireAdmin = asyncHandler(async (req, res, next) => {
  const token =
    req.cookies?.accessToken ||
    req.header("Authorization")?.replace('Bearer ', '');

  if (!token) {
    throw new ApiError(401, 'Token is missing');
  }

  const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_KEY);
  if (!decodedToken) {
    throw new ApiError(401, 'Invalid token');
  }

  const user = await User.findById(decodedToken._id).select('-password');
  if (!user) {
    throw new ApiError(401, 'Not authenticated');
  }

  if (!user.isAdmin) {
    throw new ApiError(403, 'Admins only');
  }
  
  next();
});
