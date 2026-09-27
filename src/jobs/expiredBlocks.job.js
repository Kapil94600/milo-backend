// ============================================
// Expired Blocks Cleanup Job
// ============================================

const { prisma } = require('../config/database');
const { logInfo } = require('../utils/logger');

const expiredBlocksJob = async () => {
  const now = new Date();

  // Find expired temporary blocks first
  const expired = await prisma.blockedUser.findMany({
    where: {
      isPermanent: false,
      expiresAt: { lt: now },
      deletedAt: null,
    },
    select: { id: true, userId: true, blockedId: true },
  });

  // Soft-delete them
  const result = await prisma.blockedUser.updateMany({
    where: {
      isPermanent: false,
      expiresAt: { lt: now },
      deletedAt: null,
    },
    data: { deletedAt: now },
  });

  if (result.count > 0) {
    logInfo(`Expired blocks cleaned: ${result.count}`);
  }

  return { cleaned: result.count, expiredIds: expired.map((b) => b.id) };
};

module.exports = { expiredBlocksJob };