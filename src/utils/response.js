// ============================================
// Standard API Response
// ============================================

const { HTTP_STATUS } = require('../common/constants');

class ApiResponse {
  // ============================================
  // Success
  // ============================================
  static success(res, data = null, message = 'Success', statusCode = HTTP_STATUS.OK) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      error: null,
      timestamp: new Date().toISOString(),
    });
  }

  static created(res, data = null, message = 'Created successfully') {
    return this.success(res, data, message, HTTP_STATUS.CREATED);
  }

  static noContent(res) {
    return res.status(HTTP_STATUS.NO_CONTENT).send();
  }

  // ============================================
  // Errors
  // ============================================
  static error(res, message = 'Error occurred', statusCode = HTTP_STATUS.BAD_REQUEST, error = null) {
    return res.status(statusCode).json({
      success: false,
      message,
      data: null,
      error,
      timestamp: new Date().toISOString(),
    });
  }

  static badRequest(res, message = 'Bad request', error = null) {
    return this.error(res, message, HTTP_STATUS.BAD_REQUEST, error);
  }

  static unauthorized(res, message = 'Unauthorized') {
    return this.error(res, message, HTTP_STATUS.UNAUTHORIZED);
  }

  static forbidden(res, message = 'Forbidden') {
    return this.error(res, message, HTTP_STATUS.FORBIDDEN);
  }

  static notFound(res, message = 'Resource not found') {
    return this.error(res, message, HTTP_STATUS.NOT_FOUND);
  }

  static conflict(res, message = 'Conflict', error = null) {
    return this.error(res, message, HTTP_STATUS.CONFLICT, error);
  }

  static validationError(res, errors = null) {
    return this.error(res, 'Validation failed', HTTP_STATUS.UNPROCESSABLE_ENTITY, errors);
  }

  static tooMany(res, message = 'Too many requests') {
    return this.error(res, message, HTTP_STATUS.TOO_MANY_REQUESTS);
  }

  static serverError(res, message = 'Internal server error') {
    return this.error(res, message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }

  // ============================================
  // Pagination helper
  // ============================================
  static paginated(res, data, pagination, message = 'Success') {
    return this.success(res, { data, pagination }, message);
  }
}

module.exports = ApiResponse;