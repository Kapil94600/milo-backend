// ============================================
// Authentication & Authorization Middleware
// ============================================

const jwt = require('jsonwebtoken');
const config = require('../config');
const { prisma } = require('../config/database');
const { cache, isRedisAvailable } = require('../config/redis');
const AppError = require('../utils/AppError');
const ApiResponse = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const { logDebug, logError } = require('../utils/logger');
const { ROLES, STATUS } = require('../common/constants');

const USER_CACHE_TTL = 300;

// ============================================
// Fetch user (with optional cache)
// ============================================
const fetchUser = async (userId) => {
  const cacheKey = `user:auth:${userId}`;

  if (isRedisAvailable()) {
    const cached = await cache.get(cacheKey);
    if (cached) return cached;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      phone: true,
      email: true,
      name: true,
      role: true,
      status: true,
      isActive: true,
      isVerified: true,
      deletedAt: true,
    },
  });

  if (user && isRedisAvailable()) {
    await cache.set(cacheKey, user, USER_CACHE_TTL).catch(() => {});
  }

  return user;
};

// ============================================
// Verify JWT token
// ============================================
const authenticate = asyncHandler(async (req, res, next) => {
  let token = null;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return ApiResponse.unauthorized(res, 'No token provided');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, config.JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return ApiResponse.unauthorized(res, 'Token expired');
    }
    if (error.name === 'JsonWebTokenError') {
      return ApiResponse.unauthorized(res, 'Invalid token');
    }
    return ApiResponse.unauthorized(res, 'Authentication failed');
  }

  const user = await fetchUser(decoded.id);

  if (!user || user.deletedAt) {
    return ApiResponse.unauthorized(res, 'User not found');
  }

  if (!user.isActive || user.status === STATUS.BLOCKED) {
    return ApiResponse.forbidden(res, 'Account is blocked or inactive');
  }

  req.user = { ...user, _id: user.id };
  req.token = token;
  req.userId = user.id;
  next();
});

// ============================================
// Optional auth
// ============================================
const optionalAuth = asyncHandler(async (req, res, next) => {
  try {
    let token = null;
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) return next();

    const decoded = jwt.verify(token, config.JWT_SECRET);
    const user = await fetchUser(decoded.id);

    if (user && user.isActive && !user.deletedAt && user.status !== STATUS.BLOCKED) {
      req.user = { ...user, _id: user.id };
      req.token = token;
      req.userId = user.id;
    }
  } catch (e) {
    logDebug('optionalAuth: token invalid or expired', { error: e.message });
  }
  next();
});

// ============================================
// Role-based authorization
// ============================================
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return ApiResponse.unauthorized(res, 'User not authenticated');
    }
    if (!allowedRoles.includes(req.user.role)) {
      return ApiResponse.forbidden(res, 'Insufficient permissions');
    }
    next();
  };
};

const requireAdmin = authorize(ROLES.ADMIN);
const requireGirl = authorize(ROLES.GIRL);
const requireUser = authorize(ROLES.USER);

// ============================================
// Owner OR admin check
// ============================================
const requireOwnerOrAdmin = (paramName = 'id') => {
  return (req, res, next) => {
    if (!req.user) {
      return ApiResponse.unauthorized(res, 'User not authenticated');
    }

    const resourceId = req.params[paramName];
    const isOwner = resourceId && resourceId === req.user.id;
    const isAdmin = req.user.role === ROLES.ADMIN;

    if (!isOwner && !isAdmin) {
      return ApiResponse.forbidden(res, 'Not authorized to access this resource');
    }

    next();
  };
};

// ============================================
// Deny admins (mobile-only endpoints)
// ============================================
const denyAdmins = (req, res, next) => {
  if (req.user && req.user.role === ROLES.ADMIN) {
    return ApiResponse.forbidden(res, 'Admin access only from web panel');
  }
  next();
};

// ============================================
// Invalidate user cache
// ============================================
const invalidateUserCache = async (userId) => {
  if (isRedisAvailable()) {
    await cache.del(`user:auth:${userId}`).catch(() => {});
  }
};

module.exports = {
  authenticate,
  optionalAuth,
  authorize,
  requireAdmin,
  requireGirl,
  requireUser,
  requireOwnerOrAdmin,
  denyAdmins,
  invalidateUserCache,
};