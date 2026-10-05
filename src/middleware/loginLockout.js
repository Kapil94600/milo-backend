// ============================================
// Login Lockout Middleware — Bond
// For OTP-based login (no password)
// Prevents OTP brute-force
// ============================================

const { cache, isRedisAvailable } = require('../config/redis');
const { logWarn } = require('../utils/logger');

// ============================================
// Config — OTP specific
// ============================================
const MAX_OTP_ATTEMPTS = 5;          // 5 wrong OTPs
const MAX_OTP_REQUESTS = 5;          // 5 OTP requests per window
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;   // 15 min lockout
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;     // 15 min window

// ============================================
// Memory fallback store
// ============================================
const memoryStore = new Map();

// ============================================
// Get key
// ============================================
const getKey = (type, identifier) => `lockout:${type}:${identifier}`;

// ============================================
// Generic check
// ============================================
const isLockedOut = async (type, identifier) => {
  const key = getKey(type, identifier);

  let data;
  if (isRedisAvailable()) {
    data = await cache.get(key);
  } else {
    data = memoryStore.get(key);
  }

  if (!data) return { locked: false };

  if (data.lockedUntil && data.lockedUntil > Date.now()) {
    return {
      locked: true,
      remainingMs: data.lockedUntil - Date.now(),
      attempts: data.attempts,
    };
  }

  return { locked: false, attempts: data.attempts || 0 };
};

// ============================================
// Record attempt
// ============================================
const recordAttempt = async (type, identifier, maxAttempts) => {
  const key = getKey(type, identifier);

  let data;
  if (isRedisAvailable()) {
    data = (await cache.get(key)) || { attempts: 0, firstAt: Date.now() };
  } else {
    data = memoryStore.get(key) || { attempts: 0, firstAt: Date.now() };
  }

  // Reset if window expired
  if (Date.now() - data.firstAt > ATTEMPT_WINDOW_MS) {
    data = { attempts: 0, firstAt: Date.now() };
  }

  data.attempts = (data.attempts || 0) + 1;
  data.lastAt = Date.now();

  // Lock if exceeded
  if (data.attempts >= maxAttempts) {
    data.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;

    logWarn(`🔒 Lockout triggered: ${type}:${identifier}`, {
      attempts: data.attempts,
      lockedUntil: new Date(data.lockedUntil).toISOString(),
    });
  }

  if (isRedisAvailable()) {
    await cache.set(key, data, Math.ceil(ATTEMPT_WINDOW_MS / 1000));
  } else {
    memoryStore.set(key, data);
  }

  return data;
};

// ============================================
// Clear attempts
// ============================================
const clearAttempts = async (type, identifier) => {
  const key = getKey(type, identifier);

  if (isRedisAvailable()) {
    await cache.del(key);
  } else {
    memoryStore.delete(key);
  }
};

// ============================================
// ⭐ MIDDLEWARE: OTP VERIFY lockout
// Use on /auth/verify-otp and /auth/firebase-login
// ============================================
const checkOtpLockout = async (req, res, next) => {
  try {
    const identifier = req.body?.phone || req.ip;
    if (!identifier) return next();

    const { locked, remainingMs } = await isLockedOut('otp', identifier);

    if (locked) {
      const minutes = Math.ceil(remainingMs / 60000);
      return res.status(429).json({
        success: false,
        message: `Too many failed OTP attempts. Try again in ${minutes} minute${
          minutes > 1 ? 's' : ''
        }.`,
        data: null,
        error: 'OTP_LOCKED',
        timestamp: new Date().toISOString(),
      });
    }

    next();
  } catch (e) {
    next(); // fail open
  }
};

// ============================================
// ⭐ MIDDLEWARE: OTP REQUEST lockout
// Use on /auth/request-otp
// ============================================
const checkOtpRequestLockout = async (req, res, next) => {
  try {
    const identifier = req.body?.phone || req.ip;
    if (!identifier) return next();

    const { locked, remainingMs } = await isLockedOut('otpReq', identifier);

    if (locked) {
      const minutes = Math.ceil(remainingMs / 60000);
      return res.status(429).json({
        success: false,
        message: `Too many OTP requests. Try again in ${minutes} minute${
          minutes > 1 ? 's' : ''
        }.`,
        data: null,
        error: 'OTP_REQUEST_LOCKED',
        timestamp: new Date().toISOString(),
      });
    }

    next();
  } catch (e) {
    next();
  }
};

// ============================================
// Helper: record failed OTP verify
// Call from auth.service when OTP is wrong
// ============================================
const recordOtpFailure = async (phone) => {
  if (!phone) return;
  return recordAttempt('otp', phone, MAX_OTP_ATTEMPTS);
};

// ============================================
// Helper: record OTP request
// Call from auth.service when OTP requested
// ============================================
const recordOtpRequest = async (phone) => {
  if (!phone) return;
  return recordAttempt('otpReq', phone, MAX_OTP_REQUESTS);
};

// ============================================
// Helper: clear on success
// ============================================
const clearOtpAttempts = async (phone) => {
  if (!phone) return;
  await clearAttempts('otp', phone);
};

// ============================================
// Cron helper: cleanup expired
// ============================================
const cleanupExpiredLockouts = async () => {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, data] of memoryStore.entries()) {
    if (
      (data.lockedUntil && data.lockedUntil < now) ||
      (data.firstAt && now - data.firstAt > ATTEMPT_WINDOW_MS * 2)
    ) {
      memoryStore.delete(key);
      cleaned++;
    }
  }

  return { cleaned };
};

// ============================================
// Exports
// ============================================
module.exports = {
  // Middleware
  checkOtpLockout,
  checkOtpRequestLockout,
  // Helpers
  recordOtpFailure,
  recordOtpRequest,
  clearOtpAttempts,
  // Utils
  isLockedOut,
  cleanupExpiredLockouts,
  // Config
  MAX_OTP_ATTEMPTS,
  MAX_OTP_REQUESTS,
  LOCKOUT_DURATION_MS,
};