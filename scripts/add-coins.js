// ============================================
// Quick script: Add coins to test user
// Run: node scripts/add-coins.js 9876543210 50000
// ============================================

const { prisma } = require('../src/config/database');

async function addCoins(phone, coins) {
  try {
    const user = await prisma.user.findUnique({
      where: { phone },
      include: { wallet: true },
    });

    if (!user) {
      console.error('❌ User not found:', phone);
      process.exit(1);
    }

    if (!user.wallet) {
      console.log('📝 Creating wallet...');
      await prisma.wallet.create({
        data: { userId: user.id, balance: 0, coins: 0 },
      });
    }

    const updated = await prisma.wallet.update({
      where: { userId: user.id },
      data: {
        coins: { increment: coins },
        balance: { increment: coins * 0.1 },
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { totalCoins: { increment: coins } },
    });

    console.log('✅ Coins added!');
    console.log('   User:', user.name, '(' + phone + ')');
    console.log('   Added:', coins);
    console.log('   New coins:', updated.coins);
    console.log('   New balance:', updated.balance);
  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

const phone = process.argv[2];
const coins = parseInt(process.argv[3]) || 50000;

if (!phone) {
  console.error('Usage: node scripts/add-coins.js <phone> [coins]');
  process.exit(1);
}

addCoins(phone, coins);