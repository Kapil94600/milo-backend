// ============================================
// Test DB Helpers — Bond
// ============================================

const { PrismaClient } = require('@prisma/client');

const prisma = global.__PRISMA__ || new PrismaClient();

/**
 * Clean all tables in correct order
 */
const cleanDatabase = async () => {
  await global.cleanupDatabase();
};

/**
 * Seed minimal test data
 */
const seedDatabase = async () => {
  return await global.seedTestData();
};

/**
 * Create a test user
 */
const createTestUser = async (overrides = {}) => {
  return prisma.user.create({
    data: {
      phone: overrides.phone || `9${Date.now().toString().slice(-9)}`,
      name: overrides.name || 'Test User',
      email: overrides.email || `test${Date.now()}@bond.test`,
      role: overrides.role || 'USER',
      isActive: true,
      isVerified: true,
      referralCode: overrides.referralCode || `REF${Date.now()}`,
      wallet: {
        create: {
          balance: overrides.balance ?? 0,
          coins: overrides.coins ?? 0,
        },
      },
      ...overrides,
    },
    include: { wallet: true },
  });
};

/**
 * Create a test girl
 */
const createTestGirl = async (userOverrides = {}, girlOverrides = {}) => {
  const user = await createTestUser({
    role: 'GIRL',
    name: 'Test Girl',
    ...userOverrides,
  });

  const girl = await prisma.girl.create({
    data: {
      userId: user.id,
      isOnline: true,
      isAvailable: true,
      isVerified: true,
      hourlyRate: 100,
      videoCallRate: 200,
      chatMessageRate: 1,
      rateApproved: true,
      categories: ['Chat'],
      languages: ['English'],
      ...girlOverrides,
    },
  });

  return { user, girl };
};

/**
 * Create a test admin
 */
const createTestAdmin = async (overrides = {}) => {
  const user = await createTestUser({
    role: 'ADMIN',
    name: 'Test Admin',
    email: `admin${Date.now()}@bond.test`,
    ...overrides,
  });

  const admin = await prisma.admin.create({
    data: {
      userId: user.id,
      role: 'ADMIN',
      canManageAdmins: false,
    },
  });

  return { user, admin };
};

/**
 * Create a direct chat between two users
 */
const createTestChat = async (userId1, userId2) => {
  return prisma.chat.create({
    data: {
      type: 'DIRECT',
      participants: {
        create: [{ userId: userId1 }, { userId: userId2 }],
      },
    },
    include: {
      participants: true,
    },
  });
};

/**
 * Create a test message
 */
const createTestMessage = async (chatId, senderId, content = 'Test message') => {
  const message = await prisma.message.create({
    data: {
      chatId,
      senderId,
      content,
      type: 'TEXT',
    },
  });

  await prisma.chat.update({
    where: { id: chatId },
    data: { lastMessageAt: new Date(), lastMessageId: message.id },
  });

  return message;
};

/**
 * Create a test transaction
 */
const createTestTransaction = async (userId, data = {}) => {
  return prisma.transaction.create({
    data: {
      userId,
      type: data.type || 'CREDIT',
      category: data.category || 'ADMIN_ADD',
      amount: data.amount || 0,
      coins: data.coins || 100,
      description: data.description || 'Test transaction',
      status: 'COMPLETED',
    },
  });
};

/**
 * Create a test setting
 */
const createTestSetting = async (key, value, options = {}) => {
  return prisma.setting.upsert({
    where: { key },
    update: { value },
    create: {
      key,
      value,
      type: options.type || 'NUMBER',
      category: options.category || 'GENERAL',
      description: options.description || `Test setting: ${key}`,
    },
  });
};

/**
 * Get Prisma client
 */
const getPrisma = () => prisma;

module.exports = {
  prisma,
  getPrisma,
  cleanDatabase,
  seedDatabase,
  createTestUser,
  createTestGirl,
  createTestAdmin,
  createTestChat,
  createTestMessage,
  createTestTransaction,
  createTestSetting,
};