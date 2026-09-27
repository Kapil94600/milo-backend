// ============================================
// Redis Client (Optional — graceful degradation)
// ============================================

const { createClient } = require('redis');
const config = require('./index');
const { logInfo, logError } = require('../utils/logger');

let redisClient = null;
let redisPubClient = null;
let redisSubClient = null;
let redisAvailable = false;
let isConnecting = false;

// ============================================
// Main Redis Client
// ============================================
const getRedisClient = async () => {
  if (redisClient && redisClient.isOpen) return redisClient;

  if (isConnecting) return null;
  isConnecting = true;

  try {
    redisClient = createClient({
      url: config.REDIS_URL,
      socket: {
        connectTimeout: 3000,
        reconnectStrategy: (retries) => {
          // Stop after 3 attempts in development
          if (retries > 3) return false;
          return Math.min(retries * 1000, 5000);
        },
      },
    });

    // Suppress noisy errors
    redisClient.on('error', (err) => {
      redisAvailable = false;
      logError('Redis client error', { error: err.message });
    });

    redisClient.on('connect', () => {
      redisAvailable = true;
      logInfo('✅ Redis connected');
    });

    redisClient.on('reconnecting', () => {
      logInfo('🔄 Redis reconnecting...');
    });

    await redisClient.connect();
    isConnecting = false;
    return redisClient;
  } catch (error) {
    isConnecting = false;
    redisAvailable = false;
    logError('Redis connection failed', { error: error.message });
    return null;
  }
};

// ============================================
// Pub/Sub Clients
// ============================================
const getRedisPubSub = async () => {
  if (redisPubClient?.isOpen && redisSubClient?.isOpen) {
    return { pubClient: redisPubClient, subClient: redisSubClient };
  }

  try {
    redisPubClient = createClient({
      url: config.REDIS_URL,
      socket: {
        connectTimeout: 3000,
        reconnectStrategy: () => false, // don't retry
      },
    });
    redisSubClient = redisPubClient.duplicate();

    redisPubClient.on('error', () => {});
    redisSubClient.on('error', () => {});

    await Promise.all([redisPubClient.connect(), redisSubClient.connect()]);
    redisAvailable = true;
    logInfo('✅ Redis Pub/Sub connected');
    return { pubClient: redisPubClient, subClient: redisSubClient };
  } catch (e) {
    redisPubClient = null;
    redisSubClient = null;
    redisAvailable = false;
    return { pubClient: null, subClient: null };
  }
};

// ============================================
// Close
// ============================================
const closeRedis = async () => {
  try {
    if (redisClient?.isOpen) await redisClient.quit();
    if (redisPubClient?.isOpen) await redisPubClient.quit();
    if (redisSubClient?.isOpen) await redisSubClient.quit();
    logInfo('Redis connections closed');
  } catch {
    // silent
  }
};

// ============================================
// Cache Helpers — Gracefully handle no Redis
// ============================================
const cache = {
  async get(key) {
    if (!redisAvailable || !redisClient?.isOpen) return null;
    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  },

  async set(key, value, ttlSeconds = 300) {
    if (!redisAvailable || !redisClient?.isOpen) return false;
    try {
      await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },

  async del(key) {
    if (!redisAvailable || !redisClient?.isOpen) return false;
    try {
      await redisClient.del(key);
      return true;
    } catch {
      return false;
    }
  },

  async delPattern(pattern) {
    if (!redisAvailable || !redisClient?.isOpen) return false;
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) await redisClient.del(keys);
      return true;
    } catch {
      return false;
    }
  },
};

const isRedisAvailable = () => redisAvailable;

module.exports = {
  getRedisClient,
  getRedisPubSub,
  closeRedis,
  cache,
  isRedisAvailable,
};