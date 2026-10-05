// ============================================
// Idempotency Middleware
// ============================================

const { prisma } = require('../config/database');
const { cache, isRedisAvailable } = require('../config/redis');
const ApiResponse = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const { logInfo, logWarn } = require('../utils/logger');

const CACHE_TTL = 24 * 60 * 60;
const MEMORY_STORE = new Map();

const idempotency = asyncHandler(async (req, res, next) => {
  const method = req.method.toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return next();
  }

  const key = req.headers['x-idempotency-key'];
  if (!key) return next();

  if (key.length < 8 || key.length > 128) {
    return ApiResponse.badRequest(res, 'Invalid idempotency key');
  }

  const userId = req.user?.id || 'guest';
  const cacheKey = `idem:${userId}:${method}:${req.baseUrl}${req.path}:${key}`;

  let cached = null;
  if (isRedisAvailable()) {
    cached = await cache.get(cacheKey);
  } else {
    const memEntry = MEMORY_STORE.get(cacheKey);
    if (memEntry && memEntry.expiresAt > Date.now()) {
      cached = memEntry.value;
    } else if (memEntry) {
      MEMORY_STORE.delete(cacheKey);
    }
  }

  if (cached) {
    logWarn(`Idempotency: duplicate request`, { key, userId, path: req.path });
    return res.status(cached.statusCode || 200).json(cached.body);
  }

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const payload = { statusCode: res.statusCode, body };

      if (isRedisAvailable()) {
        cache.set(cacheKey, payload, CACHE_TTL).catch((e) =>
          logWarn('Idempotency cache set failed', { error: e.message })
        );
      } else {
        if (MEMORY_STORE.size > 10000) {
          const keys = Array.from(MEMORY_STORE.keys()).slice(0, 5000);
          keys.forEach((k) => MEMORY_STORE.delete(k));
        }
        MEMORY_STORE.set(cacheKey, {
          value: payload,
          expiresAt: Date.now() + CACHE_TTL * 1000,
        });
      }
    }
    return originalJson(body);
  };

  next();
});

module.exports = idempotency;