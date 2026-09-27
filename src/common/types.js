// ============================================
// JSDoc Type Definitions
// (For IDE autocomplete — no runtime effect)
// ============================================

/**
 * @typedef {Object} JwtPayload
 * @property {string} id
 * @property {string} phone
 * @property {string} role
 * @property {string} name
 */

/**
 * @typedef {Object} AuthTokens
 * @property {string} accessToken
 * @property {string} refreshToken
 */

/**
 * @typedef {Object} PaginationParams
 * @property {number} [page]
 * @property {number} [limit]
 * @property {string} [sortBy]
 * @property {string} [sortOrder]
 */

/**
 * @typedef {Object} PaginatedResult
 * @property {Array} data
 * @property {Object} pagination
 * @property {number} pagination.page
 * @property {number} pagination.limit
 * @property {number} pagination.total
 * @property {number} pagination.totalPages
 */

/**
 * @typedef {Object} ApiSuccessResponse
 * @property {boolean} success
 * @property {string} message
 * @property {*} data
 * @property {null} error
 * @property {string} timestamp
 */

/**
 * @typedef {Object} ApiErrorResponse
 * @property {boolean} success
 * @property {string} message
 * @property {null} data
 * @property {*} error
 * @property {string} timestamp
 */

/**
 * @typedef {Object} DeviceInfo
 * @property {string} [deviceId]
 * @property {string} [platform]
 * @property {string} [version]
 * @property {string} [model]
 * @property {string} [fcmToken]
 */

/**
 * @typedef {Object} RequestUser
 * @property {string} id
 * @property {string} _id
 * @property {string} phone
 * @property {string} email
 * @property {string} name
 * @property {string} role
 * @property {string} status
 * @property {boolean} isActive
 */

module.exports = {};