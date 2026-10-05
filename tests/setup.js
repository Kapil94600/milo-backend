// ============================================
// Jest Global Setup — Bond
// ============================================

const { PrismaClient } = require('@prisma/client');

// ⭐ Test database (uses separate DB or env)
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

if (!TEST_DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set for tests');
}

// Override DATABASE_URL for tests
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';

// ⭐ Silence logger in tests
jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarn: jest.fn(),
  logDebug: jest.fn(),
}));

// ⭐ Global test Prisma client
const prisma = new PrismaClient({
  datasources: {
    db: { url: TEST_DATABASE_URL },
  },
  log: ['error'],
});

// ⭐ Before all tests
beforeAll(async () => {
  try {
    await prisma.$connect();
    console.log('✅ Test DB connected');
  } catch (e) {
    console.error('❌ Test DB connection failed:', e.message);
    process.exit(1);
  }
});

// ⭐ After all tests
afterAll(async () => {
  await prisma.$disconnect();
  console.log('✅ Test DB disconnected');
});

// ⭐ Clean tables between tests (opt-in via helper)
global.__PRISMA__ = prisma;

// ⭐ Utility: cleanup DB
global.cleanupDatabase = async (tables = []) => {
  const defaultOrder = [
    'notificationHistory',
    'scheduledNotification',
    'notification',
    'messageReaction',
    'message',
    'chatParticipant',
    'chat',
    'call',
    'giftTransaction',
    'transaction',
    'withdrawal',
    'subscription',
    'subscriptionPlan',
    'promoUsage',
    'promoCode',
    'referral',
    'review',
    'favorite',
    'blockedUser',
    'report',
    'supportMessage',
    'supportTicket',
    'otp',
    'authLog',
    'auditLog',
    'device',
    'adminLoginHistory',
    'admin',
    'girlRequest',
    'girl',
    'wallet',
    'user',
  ];

  const order = tables.length > 0 ? tables : defaultOrder;

  for (const table of order) {
    try {
      await prisma[table].deleteMany();
    } catch (e) {
      // Skip if table doesn't exist
    }
  }
};

// ⭐ Utility: seed minimal data
global.seedTestData = async () => {
  const bcrypt = require('bcryptjs');

  // Create test admin
  const adminUser = await prisma.user.create({
    data: {
      phone: '9999999999',
      email: 'test-admin@bond.test',
      name: 'Test Admin',
      role: 'ADMIN',
      isActive: true,
      isVerified: true,
      wallet: { create: { balance: 0, coins: 0 } },
    },
  });

  await prisma.admin.create({
    data: {
      userId: adminUser.id,
      role: 'SUPER_ADMIN',
      canManageAdmins: true,
    },
  });

  // Create test user
  const testUser = await prisma.user.create({
    data: {
      phone: '9876543210',
      email: 'test-user@bond.test',
      name: 'Test User',
      role: 'USER',
      isActive: true,
      isVerified: true,
      referralCode: 'TEST001',
      wallet: {
        create: { balance: 1000, coins: 5000 },
      },
    },
  });

  // Create test girl
  const girlUser = await prisma.user.create({
    data: {
      phone: '9876543211',
      name: 'Test Girl',
      role: 'GIRL',
      isActive: true,
      isVerified: true,
      referralCode: 'TEST002',
      wallet: { create: { balance: 0, coins: 0 } },
    },
  });

  const girl = await prisma.girl.create({
    data: {
      userId: girlUser.id,
      isOnline: true,
      isAvailable: true,
      isVerified: true,
      hourlyRate: 100,
      videoCallRate: 200,
      chatMessageRate: 1,
      rateApproved: true,
      categories: ['Chat'],
      languages: ['English'],
    },
  });

  return {
    admin: adminUser,
    user: testUser,
    girl,
    girlUser,
  };
};

// Increase timeout for integration tests
jest.setTimeout(30000);