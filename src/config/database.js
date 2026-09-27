// ============================================
// Prisma Client (PostgreSQL)
// ============================================

const { PrismaClient } = require('@prisma/client');
const config = require('./index');

// Singleton pattern
const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: config.IS_DEVELOPMENT
      ? ['query', 'error', 'warn']
      : ['error'],
    errorFormat: 'pretty',
  });

if (!config.IS_PRODUCTION) {
  globalForPrisma.prisma = prisma;
}

// ============================================
// Connect DB
// ============================================
const connectDatabase = async () => {
  try {
    await prisma.$connect();
    console.log('✅ PostgreSQL connected via Prisma');
    return prisma;
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error.message);
    process.exit(1);
  }
};

// ============================================
// Disconnect DB
// ============================================
const disconnectDatabase = async () => {
  try {
    await prisma.$disconnect();
    console.log('✅ PostgreSQL disconnected');
  } catch (error) {
    console.error('❌ PostgreSQL disconnect failed:', error.message);
  }
};

module.exports = {
  prisma,
  connectDatabase,
  disconnectDatabase,
};