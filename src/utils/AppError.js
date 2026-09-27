// ============================================
// Custom Application Error
// ============================================

const { HTTP_STATUS } = require('../common/constants');

class AppError extends Error {
  constructor(message, statusCode = HTTP_STATUS.BAD_REQUEST, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }

  // ============================================
  // Static Factory Methods
  // ============================================
  static badRequest(message = 'Bad request', errors = null) {
    return new AppError(message, HTTP_STATUS.BAD_REQUEST, errors);
  }

  static unauthorized(message = 'Unauthorized') {
    return new AppError(message, HTTP_STATUS.UNAUTHORIZED);
  }

  static forbidden(message = 'Forbidden') {
    return new AppError(message, HTTP_STATUS.FORBIDDEN);
  }

  static notFound(message = 'Resource not found') {
    return new AppError(message, HTTP_STATUS.NOT_FOUND);
  }

  static conflict(message = 'Conflict', errors = null) {
    return new AppError(message, HTTP_STATUS.CONFLICT, errors);
  }

  static validation(message = 'Validation failed', errors = null) {
    return new AppError(message, HTTP_STATUS.UNPROCESSABLE_ENTITY, errors);
  }

  static tooMany(message = 'Too many requests') {
    return new AppError(message, HTTP_STATUS.TOO_MANY_REQUESTS);
  }

  static internal(message = 'Internal server error') {
    return new AppError(message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

module.exports = AppError;