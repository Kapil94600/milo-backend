// ============================================
// Idempotency Middleware
// Prevents duplicate POST/PUT/PATCH requests
// Usage: router.post('/', idempotency, controller)
// Client sends header: X-Idempotency-Key: <uuid>
// ============================================

const { prisma } = require('../config/database');
const { cache, isRedisAvailable } = require('../config/redis');
const ApiResponse = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const { logInfo, logWarn } = require('../utils/logger');

const CACHE_TTL = 24 * 60 * 60; // 24 hours
const MEMORY_STORE = new Map(); // Fallback when Redis is down

const idempotency = asyncHandler(async (req, res, next) => {
  // Only for mutating methods
  const method = req.method.toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return next();
  }

  // Require idempotency key
  const key = req.headers['x-idempotency-key'];
  if (!key) {
    // No key → skip idempotency check (backward compatible)
    return next();
  }

  if (key.length < 8 || key.length > 128) {
    return ApiResponse.badRequest(res, 'Invalid idempotency key');
  }

  // Build cache key scoped by user + method + path + key
  const userId = req.user?.id || 'guest';
  const cacheKey = `idem:${userId}:${method}:${req.baseUrl}${req.path}:${key}`;

  // Check Redis first, then memory fallback
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

  // If seen before → return cached response
  if (cached) {
    logWarn(`Idempotency: duplicate request detected`, { key, userId, path: req.path });
    return res.status(cached.statusCode || 200).json(cached.body);
  }

  // Wrap res.json to cache the response
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    // Cache only successful responses
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const payload = { statusCode: res.statusCode, body };

      if (isRedisAvailable()) {
        cache
          .set(cacheKey, payload, CACHE_TTL)
          .catch((e) => logWarn('Idempotency cache set failed', { error: e.message }));
      } else {
        // Memory fallback (24h TTL, ~bounded)
        if (MEMORY_STORE.size > 10000) {
          // Prevent unbounded growth — clear oldest half
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