// ============================================
// Global Error Handler
// ============================================

const { Prisma } = require('@prisma/client');
const AppError = require('../utils/AppError');
const ApiResponse = require('../utils/response');
const { logError } = require('../utils/logger');
const { HTTP_STATUS } = require('../common/constants');

// Prisma error mapping
const handlePrismaError = (err) => {
  if (err.code === 'P2002') {
    const fields = err.meta?.target || [];
    const field = Array.isArray(fields) ? fields.join(', ') : fields;
    return new AppError(`${field} already exists`, HTTP_STATUS.CONFLICT);
  }
  if (err.code === 'P2003') {
    return new AppError('Related record not found', HTTP_STATUS.BAD_REQUEST);
  }
  if (err.code === 'P2025') {
    return new AppError('Record not found', HTTP_STATUS.NOT_FOUND);
  }
  if (err.code === 'P2014') {
    return new AppError('Invalid relation', HTTP_STATUS.BAD_REQUEST);
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    console.error('❌ Prisma Validation Error:', err.message);
    return new AppError('Invalid data format: ' + err.message, HTTP_STATUS.BAD_REQUEST);
  }
  if (err instanceof Prisma.PrismaClientInitializationError) {
    return new AppError('Database connection failed', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
  return null;
};

// Deep sanitize
const SENSITIVE_KEYS = [
  'password', 'otp', 'secretKey', 'token', 'refreshToken',
  'accessToken', 'apiKey', 'apiSecret', 'privateKey',
  'webhookSecret', 'signature', 'razorpay_signature', 'authorization',
  'fcmToken', 'idToken',
];

const sanitizeValue = (value, depth = 0) => {
  if (depth > 5) return '[deep]';
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => sanitizeValue(v, depth + 1));

  const out = {};
  for (const [key, val] of Object.entries(value)) {
    if (SENSITIVE_KEYS.includes(key) || SENSITIVE_KEYS.includes(key.toLowerCase())) {
      out[key] = '***';
    } else {
      out[key] = sanitizeValue(val, depth + 1);
    }
  }
  return out;
};

// Main error handler
const errorHandler = (err, req, res, next) => {
  logError(err, {
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: req.user?.id,
    body: req.method !== 'GET' ? sanitizeValue(req.body) : undefined,
    query: req.query,
  });

  // 1. Prisma errors
  const prismaError = handlePrismaError(err);
  if (prismaError) {
    return ApiResponse.error(res, prismaError.message, prismaError.statusCode, prismaError.errors);
  }

  // 2. JWT errors
  if (err.name === 'JsonWebTokenError') {
    return ApiResponse.unauthorized(res, 'Invalid token');
  }
  if (err.name === 'TokenExpiredError') {
    return ApiResponse.unauthorized(res, 'Token expired');
  }

  // 3. Multer errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return ApiResponse.badRequest(res, 'File too large');
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return ApiResponse.badRequest(res, 'Too many files');
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return ApiResponse.badRequest(res, 'Unexpected file field');
    }
    return ApiResponse.badRequest(res, err.message);
  }

  // 4. Custom AppError
  if (err instanceof AppError) {
    return ApiResponse.error(res, err.message, err.statusCode, err.errors);
  }

  // 5. Body parser errors
  if (err.type === 'entity.parse.failed') {
    return ApiResponse.badRequest(res, 'Invalid JSON in request body');
  }
  if (err.type === 'entity.too.large') {
    return ApiResponse.badRequest(res, 'Request body too large');
  }

  // 6. CORS errors
  if (err.message && err.message.includes('CORS')) {
    return ApiResponse.forbidden(res, 'CORS: Origin not allowed');
  }

  // 7. Default
  const statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const message =
    statusCode === HTTP_STATUS.INTERNAL_SERVER_ERROR
      ? 'Internal server error'
      : err.message || 'Something went wrong';

  return ApiResponse.error(res, message, statusCode, err.errors || null);
};

// 404 handler
const notFoundHandler = (req, res) => {
  return ApiResponse.notFound(res, `Route ${req.method} ${req.path} not found`);
};

module.exports = errorHandler;
module.exports.notFoundHandler = notFoundHandler;