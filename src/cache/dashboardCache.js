// ============================================
// Dashboard Cache — Bond
// Redis caching for expensive dashboard queries
// ============================================

const { cache, isRedisAvailable } = require('../config/redis');
const { logInfo, logWarn } = require('../utils/logger');

// ============================================
// TTL configs
// ============================================
const TTL = {
  DASHBOARD_STATS: 60,        // 60 seconds
  USER_GROWTH: 300,           // 5 minutes
  REVENUE_STATS: 300,         // 5 minutes
  RECENT_ACTIVITIES: 30,      // 30 seconds
  TOP_PERFORMERS: 300,        // 5 minutes
  ANALYTICS: 600,             // 10 minutes
};

// ============================================
// Get or compute with cache
// ============================================
const getCached = async (key, ttl, computeFn) => {
  if (!isRedisAvailable()) {
    return computeFn();
  }

  try {
    const cached = await cache.get(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }

    const result = await computeFn();

    await cache.set(key, result, ttl).catch((e) => {
      logWarn('Cache set failed', { key, error: e.message });
    });

    return result;
  } catch (e) {
    logWarn('Cache get failed, falling back', { key, error: e.message });
    return computeFn();
  }
};

// ============================================
// Invalidate
// ============================================
const invalidateDashboard = async () => {
  if (!isRedisAvailable()) return;

  try {
    await cache.delPattern('dashboard:*');
    logInfo('Dashboard cache invalidated');
  } catch (e) {
    logWarn('Cache invalidation failed', e);
  }
};

const invalidateAll = async () => {
  if (!isRedisAvailable()) return;

  try {
    await cache.delPattern('dashboard:*');
    await cache.delPattern('analytics:*');
    logInfo('All analytics caches invalidated');
  } catch (e) {
    logWarn('Cache invalidation failed', e);
  }
};

// ============================================
// Wrapper keys
// ============================================
const keys = {
  dashboardStats: () => 'dashboard:stats',
  userGrowth: (days) => `dashboard:growth:${days}`,
  revenueStats: (days) => `dashboard:revenue:${days}`,
  recentActivities: (limit) => `dashboard:activities:${limit}`,
  revenueChart: (days) => `dashboard:revenue-chart:${days}`,
  callsChart: (days) => `dashboard:calls-chart:${days}`,
  topGirls: (limit) => `dashboard:top-girls:${limit}`,
  topUsers: (limit) => `dashboard:top-users:${limit}`,
  analytics: (start, end) => `analytics:${start}:${end}`,
};

module.exports = {
  getCached,
  invalidateDashboard,
  invalidateAll,
  keys,
  TTL,
};