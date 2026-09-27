const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // ============================================
  // 1. DEFAULT SETTINGS
  // ============================================
  const settings = [
    // ============================================
    // Coins — economy
    // ============================================
    { key: 'COIN_MESSAGE_COST', value: 1, type: 'NUMBER', category: 'COINS', description: 'Cost per message in coins' },
    { key: 'COIN_VOICE_COST_PER_MINUTE', value: 10, type: 'NUMBER', category: 'COINS', description: 'Voice call cost per minute' },
    { key: 'COIN_VIDEO_COST_PER_MINUTE', value: 20, type: 'NUMBER', category: 'COINS', description: 'Video call cost per minute' },
    { key: 'COIN_SIGNUP_BONUS', value: 100, type: 'NUMBER', category: 'COINS', description: 'Signup bonus coins' },
    { key: 'COIN_REFERRAL_BONUS', value: 50, type: 'NUMBER', category: 'COINS', description: 'Referral bonus coins' },
    { key: 'COIN_DAILY_BONUS', value: 10, type: 'NUMBER', category: 'COINS', description: 'Daily login bonus coins' },
    { key: 'COIN_WITHDRAW_LIMIT', value: 100, type: 'NUMBER', category: 'COINS', description: 'Minimum coins for withdrawal' },
    { key: 'COIN_GIFT_RECEIVER_PERCENT', value: 50, type: 'NUMBER', category: 'COINS', description: 'Percentage of gift coins receiver gets' },

    // ============================================
    // Chat costs (per message)
    // ============================================
    { key: 'CHAT_MESSAGE_COST', value: 1, type: 'NUMBER', category: 'COINS', description: 'Coins deducted per text message' },
    { key: 'CHAT_MEDIA_COST', value: 5, type: 'NUMBER', category: 'COINS', description: 'Coins deducted per media message (image/video/audio/file)' },
    { key: 'CHAT_GIRL_EARNING_PERCENT', value: 50, type: 'NUMBER', category: 'COINS', description: 'Percentage of chat message coins girl receives (0-100)' },

    // ============================================
    // Video call gate
    // ============================================
    { key: 'CALL_MIN_COINS_FOR_VIDEO', value: 50, type: 'NUMBER', category: 'CALLS', description: 'Minimum coins required to enable video calls' },

    // ============================================
    // Calls
    // ============================================
    { key: 'CALL_MIN_VOICE_HOURS_FOR_VIDEO', value: 1, type: 'NUMBER', category: 'CALLS', description: 'Min voice hours before video unlock (deprecated — see CALL_MIN_COINS_FOR_VIDEO)' },
    { key: 'CALL_MAX_DURATION_MINUTES', value: 60, type: 'NUMBER', category: 'CALLS', description: 'Max call duration' },

    // ============================================
    // Chat
    // ============================================
    { key: 'CHAT_MAX_MESSAGE_LENGTH', value: 1000, type: 'NUMBER', category: 'CHAT', description: 'Max message length' },
    { key: 'CHAT_MAX_MEDIA_SIZE_MB', value: 10, type: 'NUMBER', category: 'CHAT', description: 'Max media size' },

    // ============================================
    // Payment
    // ============================================
    { key: 'PAYMENT_MIN_AMOUNT', value: 1, type: 'NUMBER', category: 'PAYMENT', description: 'Min payment amount' },
    { key: 'PAYMENT_MAX_AMOUNT', value: 100000, type: 'NUMBER', category: 'PAYMENT', description: 'Max payment amount' },
    { key: 'WITHDRAWAL_MIN_AMOUNT', value: 100, type: 'NUMBER', category: 'PAYMENT', description: 'Min withdrawal amount' },
    { key: 'WITHDRAWAL_FEE_PERCENT', value: 2, type: 'NUMBER', category: 'PAYMENT', description: 'Withdrawal fee percent' },

    // ============================================
    // Subscription
    // ============================================
    { key: 'SUBSCRIPTION_TRIAL_DAYS', value: 7, type: 'NUMBER', category: 'SUBSCRIPTION', description: 'Free trial days' },

    // ============================================
    // Referral
    // ============================================
    { key: 'REFERRAL_MAX_PER_USER', value: 100, type: 'NUMBER', category: 'REFERRAL', description: 'Max referrals per user' },

    // ============================================
    // Security
    // ============================================
    { key: 'SECURITY_MAX_LOGIN_ATTEMPTS', value: 5, type: 'NUMBER', category: 'SECURITY', description: 'Max login attempts' },
    { key: 'SECURITY_SESSION_TIMEOUT_MINUTES', value: 60, type: 'NUMBER', category: 'SECURITY', description: 'Session timeout' },

    // ============================================
    // Notification
    // ============================================
    { key: 'NOTIFICATION_PUSH_ENABLED', value: true, type: 'BOOLEAN', category: 'NOTIFICATION', description: 'Enable push notifications' },
    { key: 'NOTIFICATION_EMAIL_ENABLED', value: false, type: 'BOOLEAN', category: 'NOTIFICATION', description: 'Enable email notifications' },

    // ============================================
    // Maintenance
    // ============================================
    { key: 'MAINTENANCE_MODE', value: false, type: 'BOOLEAN', category: 'MAINTENANCE', description: 'Maintenance mode on/off' },
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }
  console.log(`✅ ${settings.length} settings created`);

  // ============================================
  // 2. DEFAULT ADMIN
  // ============================================
  const adminPhone = '9999999999';
  const adminEmail = 'admin@socialplatform.com';
  const adminPassword = 'Admin@123';

  let adminUser = await prisma.user.findUnique({ where: { phone: adminPhone } });

  if (!adminUser) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    adminUser = await prisma.user.create({
      data: {
        phone: adminPhone,
        email: adminEmail,
        name: 'Super Admin',
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true,
        isVerified: true,
        referralCode: 'SUPERADMIN',
        wallet: {
          create: {
            balance: 0,
            coins: 0,
          },
        },
      },
    });

    await prisma.admin.create({
      data: {
        userId: adminUser.id,
        role: 'SUPER_ADMIN',
        canManageAdmins: true,
      },
    });

    console.log(`✅ Admin created: ${adminPhone} / ${adminPassword}`);
  } else {
    console.log('ℹ️  Admin already exists');
  }

  // ============================================
  // 3. COIN PACKAGES
  // ============================================
  const packages = [
    { name: 'Starter', description: 'Perfect for trying out', coins: 100, bonusCoins: 0, price: 100, order: 1 },
    { name: 'Basic', description: 'Great value pack', coins: 500, bonusCoins: 50, price: 450, order: 2 },
    { name: 'Popular', description: 'Most popular choice', coins: 1000, bonusCoins: 150, price: 850, isPopular: true, order: 3 },
    { name: 'Premium', description: 'Best for regular users', coins: 2500, bonusCoins: 500, price: 2000, order: 4 },
    { name: 'Ultimate', description: 'Maximum value', coins: 5000, bonusCoins: 1500, price: 4000, order: 5 },
  ];

  for (const pkg of packages) {
    const existing = await prisma.coinPackage.findFirst({
      where: { name: pkg.name },
    });
    if (!existing) {
      await prisma.coinPackage.create({ data: pkg });
    }
  }
  console.log(`✅ ${packages.length} coin packages created`);

  // ============================================
  // 4. SUBSCRIPTION PLANS
  // ============================================
  const plans = [
    {
      name: 'Daily',
      description: 'Perfect for a day of fun',
      price: 50,
      duration: 'DAILY',
      durationDays: 1,
      features: ['50 free messages', '5 voice minutes'],
      freeMessages: 50,
      freeVoiceMinutes: 5,
      order: 1,
    },
    {
      name: 'Weekly',
      description: 'Week-long access',
      price: 250,
      duration: 'WEEKLY',
      durationDays: 7,
      features: ['500 free messages', '60 voice minutes', '20 video minutes'],
      freeMessages: 500,
      freeVoiceMinutes: 60,
      freeVideoMinutes: 20,
      bonusCoins: 100,
      order: 2,
    },
    {
      name: 'Monthly',
      description: 'Best value for regulars',
      price: 800,
      duration: 'MONTHLY',
      durationDays: 30,
      features: ['3000 free messages', '300 voice minutes', '120 video minutes', 'Priority support'],
      freeMessages: 3000,
      freeVoiceMinutes: 300,
      freeVideoMinutes: 120,
      bonusCoins: 500,
      prioritySupport: true,
      adFree: true,
      isPopular: true,
      order: 3,
    },
    {
      name: 'Yearly',
      description: 'Save 20% with annual plan',
      price: 8000,
      duration: 'YEARLY',
      durationDays: 365,
      features: ['Unlimited messages', '5000 voice minutes', '2000 video minutes', 'VIP support', 'Ad free'],
      freeMessages: -1,
      freeVoiceMinutes: 5000,
      freeVideoMinutes: 2000,
      bonusCoins: 8000,
      prioritySupport: true,
      adFree: true,
      discountPercent: 20,
      order: 4,
    },
  ];

  for (const plan of plans) {
    const existing = await prisma.subscriptionPlan.findFirst({
      where: { name: plan.name },
    });
    if (!existing) {
      await prisma.subscriptionPlan.create({ data: plan });
    }
  }
  console.log(`✅ ${plans.length} subscription plans created`);

  // ============================================
  // 5. GIFTS
  // ============================================
  const gifts = [
    { name: 'Rose', description: 'A beautiful rose', coins: 10, price: 10, category: 'FLOWERS', rarity: 'COMMON', image: '/gifts/rose.png', displayOrder: 1 },
    { name: 'Heart', description: 'Send some love', coins: 20, price: 20, category: 'HEARTS', rarity: 'COMMON', image: '/gifts/heart.png', displayOrder: 2 },
    { name: 'Star', description: 'You are a star', coins: 50, price: 50, category: 'STARS', rarity: 'UNCOMMON', image: '/gifts/star.png', displayOrder: 3 },
    { name: 'Teddy', description: 'Cute teddy bear', coins: 100, price: 100, category: 'ANIMALS', rarity: 'RARE', image: '/gifts/teddy.png', displayOrder: 4 },
    { name: 'Diamond', description: 'Shine bright like a diamond', coins: 500, price: 500, category: 'LUXURY', rarity: 'EPIC', image: '/gifts/diamond.png', displayOrder: 5 },
    { name: 'Crown', description: 'For royalty only', coins: 1000, price: 1000, category: 'LUXURY', rarity: 'LEGENDARY', image: '/gifts/crown.png', displayOrder: 6 },
  ];

  for (const gift of gifts) {
    const existing = await prisma.gift.findFirst({
      where: { name: gift.name },
    });
    if (!existing) {
      await prisma.gift.create({ data: gift });
    }
  }
  console.log(`✅ ${gifts.length} gifts created`);

  // ============================================
  // 6. APP VERSIONS
  // ============================================
  const versions = [
    { version: '1.0.0', platform: 'ANDROID', minVersion: '1.0.0', requiredVersion: '1.0.0', releaseNotes: 'Initial release', isLatest: true },
    { version: '1.0.0', platform: 'IOS', minVersion: '1.0.0', requiredVersion: '1.0.0', releaseNotes: 'Initial release', isLatest: true },
  ];

  for (const v of versions) {
    const existing = await prisma.appVersion.findFirst({
      where: { platform: v.platform, version: v.version },
    });
    if (!existing) {
      await prisma.appVersion.create({ data: v });
    }
  }
  console.log(`✅ ${versions.length} app versions created`);

  // ============================================
  // 7. MAINTENANCE (default)
  // ============================================
  const maintenance = await prisma.maintenance.findFirst();
  if (!maintenance) {
    await prisma.maintenance.create({
      data: {
        isEnabled: false,
        message: 'We are currently under maintenance. Please try again later.',
        type: 'SCHEDULED',
        affectedServices: ['ALL'],
      },
    });
    console.log('✅ Maintenance record created');
  }

  // ============================================
  // 8. SAMPLE BANNERS (optional)
  // ============================================
  const bannerCount = await prisma.banner.count();
  if (bannerCount === 0) {
    await prisma.banner.createMany({
      data: [
        {
          title: 'Welcome to Vibe!',
          subtitle: 'Meet new people',
          image: 'https://via.placeholder.com/800x400/E11D48/FFFFFF?text=Welcome',
          linkType: 'NONE',
          isActive: true,
          isFeatured: true,
          displayOrder: 1,
          platform: ['ALL'],
          roles: ['ALL'],
        },
        {
          title: 'Get 100 Bonus Coins',
          subtitle: 'Sign up bonus',
          image: 'https://via.placeholder.com/800x400/7C3AED/FFFFFF?text=Bonus+Coins',
          linkType: 'NONE',
          isActive: true,
          displayOrder: 2,
          platform: ['ALL'],
          roles: ['ALL'],
        },
      ],
    });
    console.log('✅ 2 sample banners created');
  }

  console.log('');
  console.log('============================================');
  console.log('  ✅ SEED COMPLETED SUCCESSFULLY');
  console.log('============================================');
  console.log('Admin login:');
  console.log(`  Phone:    ${adminPhone}`);
  console.log(`  Password: ${adminPassword}`);
  console.log('============================================');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });