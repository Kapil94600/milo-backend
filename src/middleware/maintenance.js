// ============================================
// Maintenance Mode Check
// ============================================

const { prisma } = require('../config/database');
const { cache, isRedisAvailable } = require('../config/redis');
const ApiResponse = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const { logWarn } = require('../utils/logger');
const { ROLES } = require('../common/constants');

const CACHE_KEY = 'maintenance:status';
const CACHE_TTL = 60;

let memCache = null;

const getMaintenanceStatus = async () => {
  if (isRedisAvailable()) {
    const cached = await cache.get(CACHE_KEY);
    if (cached) return cached;
  } else if (memCache && memCache.expiresAt > Date.now()) {
    return memCache.value;
  }

  let status = { isEnabled: false };
  try {
    const record = await prisma.maintenance.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    status = record
      ? { isEnabled: record.isEnabled, message: record.message }
      : { isEnabled: false };

    if (isRedisAvailable()) {
      await cache.set(CACHE_KEY, status, CACHE_TTL).catch(() => {});
    } else {
      memCache = { value: status, expiresAt: Date.now() + CACHE_TTL * 1000 };
    }
  } catch (e) {
    logWarn('Maintenance DB check failed', { error: e.message });
  }

  return status;
};

const checkMaintenance = asyncHandler(async (req, res, next) => {
  if (req.user && req.user.role === ROLES.ADMIN) return next();

  const skipPaths = ['/health', '/api-docs', '/favicon.ico', '/api/payments/webhook'];
  if (skipPaths.some((p) => req.path.startsWith(p))) return next();

  const status = await getMaintenanceStatus();

  if (status.isEnabled) {
    return res.status(503).json({
      success: false,
      message: status.message || 'Under maintenance',
      data: null,
      error: 'MAINTENANCE_MODE',
      timestamp: new Date().toISOString(),
    });
  }

  next();
});

const invalidateMaintenanceCache = async () => {
  memCache = null;
  if (isRedisAvailable()) {
    await cache.del(CACHE_KEY).catch(() => {});
  }
};

module.exports = checkMaintenance;
module.exports.invalidateMaintenanceCache = invalidateMaintenanceCache;