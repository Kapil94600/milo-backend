// ============================================
// Rate Limiters
// ============================================

const rateLimit = require('express-rate-limit');
const config = require('../config');
const { logWarn } = require('../utils/logger');

// Optional: Redis store for multi-instance deployments
let RedisStore = null;
let redisClient = null;

const initRedisStore = () => {
  try {
    // Try to use Redis store if available
    RedisStore = require('rate-limit-redis');
    // redisClient comes from config/redis — but we need raw client
    const { getRedisClient } = require('../config/redis');
    return getRedisClient();
  } catch (e) {
    return null;
  }
};

// ============================================
// Helper: build limiter
// ============================================
const buildLimiter = ({ windowMs, max, message, keyGenerator }) => {
  const opts = {
    windowMs,
    max,
    message: {
      success: false,
      message,
      data: null,
      error: 'Rate limit exceeded',
      timestamp: new Date().toISOString(),
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip successful requests from counting? No — count all.
    skipFailedRequests: false,
    skipSuccessfulRequests: false,
  };

  if (keyGenerator) opts.keyGenerator = keyGenerator;

  return rateLimit(opts);
};

// ============================================
// Key generator: use user id if authenticated, else IP
// ============================================
const userOrIpKey = (req) => {
  if (req.user?.id) return `user:${req.user.id}`;
  return `ip:${req.ip}`;
};

// ============================================
// General API limiter
// ============================================
const limiter = buildLimiter({
  windowMs: config.RATE_LIMIT_WINDOW * 60 * 1000,
  max: config.RATE_LIMIT_MAX,
  message: 'Too many requests, please try again later.',
});

// ============================================
// Auth limiter (stricter)
// ============================================
const authLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: config.AUTH_RATE_LIMIT_MAX,
  message: 'Too many authentication attempts, please try again later.',
});

// ============================================
// OTP limiter (very strict)
// ============================================
const otpLimiter = buildLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: 'Too many OTP requests, please try again after an hour.',
});

// ============================================
// API limiter (per minute)
// ============================================
const apiLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Too many API requests, please slow down.',
});

// ============================================
// Upload limiter
// ============================================
const uploadLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many uploads, please try again later.',
});

// ============================================
// Create generic limiter (for custom use)
// ============================================
const createLimiter = (windowMinutes = 15, maxRequests = 100, msg = 'Too many requests') =>
  buildLimiter({
    windowMs: windowMinutes * 60 * 1000,
    max: maxRequests,
    message: msg,
  });

module.exports = {
  limiter,
  authLimiter,
  otpLimiter,
  apiLimiter,
  uploadLimiter,
  createLimiter,
  userOrIpKey,
};