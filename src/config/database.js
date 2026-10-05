// ============================================
// Prisma Client (PostgreSQL) — with reconnect + keepalive
// ============================================

const { PrismaClient } = require('@prisma/client');
const config = require('./index');
const { logInfo, logError, logWarn } = require('../utils/logger');

// Singleton pattern
const globalForPrisma = globalThis;

// ✅ Connection URL me parameters add karo
const getDatabaseUrl = () => {
  let url = config.DATABASE_URL;

  if (url && !url.includes('connection_limit')) {
    const separator = url.includes('?') ? '&' : '?';
    // ⭐ Increased from 5 to 20 (production ready)
    url += `${separator}connection_limit=20&pool_timeout=20&connect_timeout=10`;
  }

  return url;
};

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: config.IS_DEVELOPMENT
      ? [
          { level: 'query', emit: 'event' },
          { level: 'error', emit: 'event' },
          { level: 'warn', emit: 'event' },
        ]
      : [{ level: 'error', emit: 'event' }],
    errorFormat: 'pretty',
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
  });

// ============================================
// ✅ Handle Prisma errors gracefully
// ============================================
prisma.$on('error', (e) => {
  // Ignore "Closed" errors — Prisma auto-reconnects
  if (e.message?.includes('Closed') || e.message?.includes('kind: Closed')) {
    logWarn('Prisma connection dropped, will reconnect on next query');
    return;
  }
  logError('Prisma error', e);
});

if (config.IS_DEVELOPMENT) {
  prisma.$on('warn', (e) => {
    logWarn('Prisma warning', e.message);
  });
}

// ============================================
// ✅ Connect DB with retry
// ============================================
const connectDatabase = async (retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await prisma.$connect();

      // ✅ Test query to verify connection
      await prisma.$queryRaw`SELECT 1`;

      logInfo('✅ PostgreSQL connected via Prisma');
      return prisma;
    } catch (error) {
      logError(
        `❌ PostgreSQL connection failed (attempt ${attempt}/${retries})`,
        error.message
      );

      if (attempt === retries) {
        logError('All connection attempts failed');
        process.exit(1);
      }

      // Wait before retry (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      logInfo(`⏳ Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

// ============================================
// ✅ Health check helper
// ============================================
const checkDatabaseHealth = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (e) {
    return false;
  }
};

// ============================================
// Disconnect DB
// ============================================
const disconnectDatabase = async () => {
  try {
    await prisma.$disconnect();
    logInfo('✅ PostgreSQL disconnected');
  } catch (error) {
    logError('❌ PostgreSQL disconnect failed', error.message);
  }
};

// ============================================
// ✅ Graceful handling of process signals
// ============================================
process.on('beforeExit', async () => {
  await disconnectDatabase();
});

module.exports = {
  prisma,
  connectDatabase,
  disconnectDatabase,
  checkDatabaseHealth,
};