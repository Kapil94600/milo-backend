// ============================================
// Rate Limiters — Bond (Fixed)
// ============================================

const rateLimit = require('express-rate-limit');
const config = require('../config');
const { logWarn } = require('../utils/logger');

// ============================================
// Build limiter
// ============================================
const buildLimiter = ({ windowMs, max, message, keyGenerator, skip }) => {
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
    skipFailedRequests: false,
    skipSuccessfulRequests: false,
    // ⭐ Trust proxy — for correct IP detection behind proxy
    validate: {
      trustProxy: false,
    },
  };

  if (keyGenerator) opts.keyGenerator = keyGenerator;
  if (skip) opts.skip = skip;

  // ⭐ Log rate limit hits
  opts.handler = (req, res, next, options) => {
    logWarn('Rate limit hit', {
      ip: req.ip,
      userId: req.user?.id,
      path: req.path,
      method: req.method,
    });
    res.status(options.statusCode).json(options.message);
  };

  return rateLimit(opts);
};

// ============================================
// ⭐ SAFE Key generator
// Uses userId if available (after auth), otherwise IP
// ============================================
const userOrIpKey = (req) => {
  // If authenticated (auth middleware ran)
  if (req.user?.id) {
    return `user:${req.user.id}`;
  }

  // Fall back to IP (using express proxy settings)
  return `ip:${req.ip}`;
};

// ============================================
// General API limiter
// ============================================
const limiter = buildLimiter({
  windowMs: config.RATE_LIMIT_WINDOW * 60 * 1000,
  max: config.RATE_LIMIT_MAX,
  message: 'Too many requests, please try again later.',
  keyGenerator: userOrIpKey,
});

// ============================================
// Auth limiter (stricter — IP-based only)
// ============================================
// Auth endpoints run BEFORE authentication, so must be IP-based
const authLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: config.AUTH_RATE_LIMIT_MAX,
  message: 'Too many authentication attempts, please try again later.',
  // ⭐ IP-only because user not yet authenticated
  keyGenerator: (req) => `auth:${req.ip}`,
});

// ============================================
// OTP limiter (very strict)
// ============================================
const otpLimiter = buildLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many OTP requests, please try again after an hour.',
  keyGenerator: (req) => `otp:${req.ip}`,
});

// ============================================
// API limiter (short window)
// ============================================
const apiLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Too many API requests, please slow down.',
  keyGenerator: userOrIpKey,
});

// ============================================
// Upload limiter
// ============================================
const uploadLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many uploads, please try again later.',
  keyGenerator: userOrIpKey,
});

// ============================================
// Message limiter (chat spam prevention)
// ============================================
const messageLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many messages, please slow down.',
  keyGenerator: userOrIpKey,
});

// ============================================
// Call limiter (call spam prevention)
// ============================================
const callLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many call attempts, please wait.',
  keyGenerator: userOrIpKey,
});

// ============================================
// Custom limiter factory
// ============================================
const createLimiter = (
  windowMinutes = 15,
  maxRequests = 100,
  msg = 'Too many requests'
) =>
  buildLimiter({
    windowMs: windowMinutes * 60 * 1000,
    max: maxRequests,
    message: msg,
    keyGenerator: userOrIpKey,
  });

// ============================================
// Exports
// ============================================
module.exports = {
  limiter,
  authLimiter,
  otpLimiter,
  apiLimiter,
  uploadLimiter,
  messageLimiter,
  callLimiter,
  createLimiter,
  userOrIpKey,
};