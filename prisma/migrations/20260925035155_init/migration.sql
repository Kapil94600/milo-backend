-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'GIRL', 'ADMIN');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED', 'DELETED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('ANDROID', 'IOS', 'WEB', 'ALL');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "TransactionCategory" AS ENUM ('SIGNUP_BONUS', 'REFERRAL_BONUS', 'DAILY_BONUS', 'COIN_PURCHASE', 'SUBSCRIPTION', 'MESSAGE_COST', 'VOICE_CALL', 'VIDEO_CALL', 'GIFT_SENT', 'GIFT_RECEIVED', 'WITHDRAWAL', 'REFUND', 'PROMO_CODE', 'REWARD', 'ADMIN_ADD');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "WithdrawStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('CHAT', 'CALL', 'COIN', 'SYSTEM', 'PROMO', 'REWARD');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'PUSH', 'EMAIL', 'SMS', 'BOTH');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

-- CreateEnum
CREATE TYPE "CallType" AS ENUM ('VOICE', 'VIDEO');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('INITIATED', 'CONNECTED', 'ENDED', 'MISSED', 'REJECTED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "CallQuality" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'GIF', 'FILE', 'STICKER');

-- CreateEnum
CREATE TYPE "ChatType" AS ENUM ('DIRECT', 'GROUP');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('USER', 'MESSAGE', 'CHAT', 'CALL', 'PROFILE', 'PAYMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'REVIEWED', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReportPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ReportAction" AS ENUM ('WARNING', 'SUSPEND', 'BAN', 'DELETE', 'IGNORE', 'OTHER');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "GiftCategory" AS ENUM ('FLOWERS', 'HEARTS', 'STARS', 'ANIMALS', 'FOOD', 'LUXURY', 'EMOJI', 'SPECIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "GiftRarity" AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "SubscriptionDuration" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "PromoType" AS ENUM ('PERCENTAGE', 'FIXED', 'FREE_COINS', 'FREE_SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'COMPLETED', 'EXPIRED', 'REWARDED');

-- CreateEnum
CREATE TYPE "SupportCategory" AS ENUM ('ACCOUNT', 'PAYMENT', 'TECHNICAL', 'REPORT', 'FEEDBACK', 'WITHDRAWAL', 'COINS', 'CALLS', 'CHAT', 'SUBSCRIPTION', 'OTHER');

-- CreateEnum
CREATE TYPE "SupportPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "SupportStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('SCHEDULED', 'EMERGENCY', 'UPDATE');

-- CreateEnum
CREATE TYPE "BannerLinkType" AS ENUM ('URL', 'PAGE', 'PRODUCT', 'USER', 'GIRL', 'SUBSCRIPTION', 'COIN_PACKAGE', 'NONE');

-- CreateEnum
CREATE TYPE "AuthAction" AS ENUM ('LOGIN', 'LOGOUT', 'REGISTER', 'REFRESH', 'OTP_REQUEST', 'OTP_VERIFY');

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT NOT NULL,
    "username" TEXT,
    "password" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "profileImage" TEXT,
    "coverImage" TEXT,
    "bio" TEXT,
    "birthDate" TIMESTAMP(3),
    "gender" "Gender" NOT NULL DEFAULT 'PREFER_NOT_TO_SAY',
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLogin" TIMESTAMP(3),
    "refreshToken" TEXT,
    "referralCode" TEXT,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "fcmToken" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "darkMode" BOOLEAN NOT NULL DEFAULT false,
    "totalCoins" INTEGER NOT NULL DEFAULT 0,
    "totalEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCalls" INTEGER NOT NULL DEFAULT 0,
    "totalMessages" INTEGER NOT NULL DEFAULT 0,
    "totalVoiceMins" INTEGER NOT NULL DEFAULT 0,
    "totalVideoMins" INTEGER NOT NULL DEFAULT 0,
    "totalReferrals" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "girls" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "acceptChat" BOOLEAN NOT NULL DEFAULT true,
    "acceptCalls" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "idProofUrl" TEXT,
    "selfieUrl" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "categories" TEXT[],
    "languages" TEXT[],
    "specialties" TEXT[],
    "about" TEXT,
    "hourlyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "instagramUrl" TEXT,
    "youtubeUrl" TEXT,
    "twitterUrl" TEXT,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "totalCalls" INTEGER NOT NULL DEFAULT 0,
    "totalVoiceMins" INTEGER NOT NULL DEFAULT 0,
    "totalVideoMins" INTEGER NOT NULL DEFAULT 0,
    "totalMessages" INTEGER NOT NULL DEFAULT 0,
    "totalCoinsEarned" INTEGER NOT NULL DEFAULT 0,
    "earningsTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "earningsToday" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "earningsThisWeek" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "earningsThisMonth" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "girls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admins" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "canManageUsers" BOOLEAN NOT NULL DEFAULT true,
    "canManageGirls" BOOLEAN NOT NULL DEFAULT true,
    "canManageCoins" BOOLEAN NOT NULL DEFAULT true,
    "canManagePayments" BOOLEAN NOT NULL DEFAULT true,
    "canManageSubscriptions" BOOLEAN NOT NULL DEFAULT true,
    "canManageSettings" BOOLEAN NOT NULL DEFAULT true,
    "canManageReports" BOOLEAN NOT NULL DEFAULT true,
    "canManageNotifications" BOOLEAN NOT NULL DEFAULT true,
    "canViewAnalytics" BOOLEAN NOT NULL DEFAULT true,
    "canManageAdmins" BOOLEAN NOT NULL DEFAULT false,
    "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_login_history" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_login_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT,
    "deviceId" TEXT,
    "model" TEXT,
    "version" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otps" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "otp" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'LOGIN',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "totalEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalWithdrawn" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pendingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "category" "TransactionCategory" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'COMPLETED',
    "balanceAfter" DOUBLE PRECISION,
    "coinsAfter" INTEGER,
    "referenceId" TEXT,
    "referenceModel" TEXT,
    "idempotencyKey" TEXT,
    "gatewayResponse" JSONB,
    "failureReason" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netAmount" DOUBLE PRECISION NOT NULL,
    "status" "WithdrawStatus" NOT NULL DEFAULT 'PENDING',
    "method" TEXT NOT NULL,
    "accountName" TEXT,
    "accountNumber" TEXT,
    "ifscCode" TEXT,
    "upiId" TEXT,
    "bankName" TEXT,
    "processedBy" TEXT,
    "processedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "gatewayResponse" JSONB,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coin_packages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "coins" INTEGER NOT NULL,
    "bonusCoins" INTEGER NOT NULL DEFAULT 0,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "coin_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "duration" "SubscriptionDuration" NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "features" TEXT[],
    "freeMessages" INTEGER NOT NULL DEFAULT 0,
    "freeVoiceMinutes" INTEGER NOT NULL DEFAULT 0,
    "freeVideoMinutes" INTEGER NOT NULL DEFAULT 0,
    "bonusCoins" INTEGER NOT NULL DEFAULT 0,
    "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "prioritySupport" BOOLEAN NOT NULL DEFAULT false,
    "adFree" BOOLEAN NOT NULL DEFAULT false,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "features" JSONB,
    "usage" JSONB,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "PromoType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "maxDiscount" DOUBLE PRECISION,
    "minOrderAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxUses" INTEGER NOT NULL DEFAULT 0,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "perUserLimit" INTEGER NOT NULL DEFAULT 1,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "applicableRoles" TEXT[],
    "applicableProducts" TEXT[],
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_usages" (
    "id" TEXT NOT NULL,
    "promoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL,
    "orderId" TEXT,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredId" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "reward" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "coinsRewarded" INTEGER NOT NULL DEFAULT 0,
    "moneyRewarded" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "rewardedAt" TIMESTAMP(3),
    "conditionsMet" BOOLEAN NOT NULL DEFAULT false,
    "referrerIp" TEXT,
    "referredIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chats" (
    "id" TEXT NOT NULL,
    "type" "ChatType" NOT NULL DEFAULT 'DIRECT',
    "name" TEXT,
    "image" TEXT,
    "description" TEXT,
    "groupAdminId" TEXT,
    "lastMessageId" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_participants" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "lastReadAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "mediaUrl" TEXT,
    "replyToId" TEXT,
    "isDelivered" BOOLEAN NOT NULL DEFAULT false,
    "deliveredAt" TIMESTAMP(3),
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "editedAt" TIMESTAMP(3),
    "isDeletedForAll" BOOLEAN NOT NULL DEFAULT false,
    "deletedFor" TEXT[],
    "clientMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_reactions" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reaction" TEXT NOT NULL DEFAULT '👍',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calls" (
    "id" TEXT NOT NULL,
    "callerId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "type" "CallType" NOT NULL,
    "status" "CallStatus" NOT NULL DEFAULT 'INITIATED',
    "quality" "CallQuality" NOT NULL DEFAULT 'MEDIUM',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "duration" INTEGER NOT NULL DEFAULT 0,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "coinRate" INTEGER NOT NULL DEFAULT 0,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "recordingUrl" TEXT,
    "recordingSize" INTEGER,
    "endedById" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gifts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT NOT NULL,
    "thumbnail" TEXT,
    "animationUrl" TEXT,
    "soundUrl" TEXT,
    "coins" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "category" "GiftCategory" NOT NULL DEFAULT 'OTHER',
    "rarity" "GiftRarity" NOT NULL DEFAULT 'COMMON',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "gifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gift_transactions" (
    "id" TEXT NOT NULL,
    "giftId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "chatId" TEXT,
    "coins" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "receiverCoins" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "status" "PaymentStatus" NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "gift_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "senderId" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "image" TEXT,
    "data" JSONB,
    "action" TEXT,
    "actionData" JSONB,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "isDelivered" BOOLEAN NOT NULL DEFAULT false,
    "deliveredAt" TIMESTAMP(3),
    "fcmMessageId" TEXT,
    "clickedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportedId" TEXT NOT NULL,
    "type" "ReportType" NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" TEXT[],
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "ReportPriority" NOT NULL DEFAULT 'MEDIUM',
    "assignedToId" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "resolutionAction" "ReportAction",
    "adminNotes" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocked_users" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "reason" TEXT,
    "isPermanent" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "blocked_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "favoriteId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "reviewedId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "callId" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "category" "SupportCategory" NOT NULL,
    "priority" "SupportPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "SupportStatus" NOT NULL DEFAULT 'OPEN',
    "description" TEXT NOT NULL,
    "attachments" TEXT[],
    "assignedToId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "rating" INTEGER,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_messages" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderRole" TEXT NOT NULL DEFAULT 'USER',
    "message" TEXT NOT NULL,
    "attachments" TEXT[],
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "isEditable" BOOLEAN NOT NULL DEFAULT true,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banners" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "image" TEXT NOT NULL,
    "linkType" "BannerLinkType" NOT NULL DEFAULT 'NONE',
    "link" TEXT,
    "linkData" JSONB,
    "position" INTEGER NOT NULL DEFAULT 0,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "platform" TEXT[] DEFAULT ARRAY['ALL']::TEXT[],
    "roles" TEXT[] DEFAULT ARRAY['ALL']::TEXT[],
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_versions" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "minVersion" TEXT NOT NULL,
    "requiredVersion" TEXT NOT NULL,
    "downloadUrl" TEXT,
    "releaseNotes" TEXT,
    "isMandatory" BOOLEAN NOT NULL DEFAULT false,
    "isLatest" BOOLEAN NOT NULL DEFAULT true,
    "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "app_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance" (
    "id" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "message" TEXT NOT NULL,
    "type" "MaintenanceType" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledStart" TIMESTAMP(3),
    "scheduledEnd" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "affectedServices" TEXT[],
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "maintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "phone" TEXT NOT NULL,
    "action" "AuthAction" NOT NULL,
    "status" "AuditStatus" NOT NULL,
    "error" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "deviceInfo" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "changes" JSONB,
    "status" "AuditStatus" NOT NULL DEFAULT 'SUCCESS',
    "error" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_referralCode_key" ON "users"("referralCode");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_status_idx" ON "users"("role", "status");

-- CreateIndex
CREATE INDEX "users_isOnline_lastSeen_idx" ON "users"("isOnline", "lastSeen");

-- CreateIndex
CREATE INDEX "users_city_idx" ON "users"("city");

-- CreateIndex
CREATE UNIQUE INDEX "girls_userId_key" ON "girls"("userId");

-- CreateIndex
CREATE INDEX "girls_userId_idx" ON "girls"("userId");

-- CreateIndex
CREATE INDEX "girls_isOnline_isAvailable_idx" ON "girls"("isOnline", "isAvailable");

-- CreateIndex
CREATE INDEX "girls_rating_idx" ON "girls"("rating");

-- CreateIndex
CREATE INDEX "girls_status_idx" ON "girls"("status");

-- CreateIndex
CREATE UNIQUE INDEX "admins_userId_key" ON "admins"("userId");

-- CreateIndex
CREATE INDEX "admins_userId_idx" ON "admins"("userId");

-- CreateIndex
CREATE INDEX "admins_role_idx" ON "admins"("role");

-- CreateIndex
CREATE INDEX "admin_login_history_adminId_createdAt_idx" ON "admin_login_history"("adminId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "devices_token_key" ON "devices"("token");

-- CreateIndex
CREATE INDEX "devices_userId_idx" ON "devices"("userId");

-- CreateIndex
CREATE INDEX "otps_phone_isUsed_idx" ON "otps"("phone", "isUsed");

-- CreateIndex
CREATE INDEX "otps_expiresAt_idx" ON "otps"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_userId_key" ON "wallets"("userId");

-- CreateIndex
CREATE INDEX "wallets_userId_idx" ON "wallets"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_idempotencyKey_key" ON "transactions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "transactions_userId_createdAt_idx" ON "transactions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "transactions_type_category_idx" ON "transactions"("type", "category");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "withdrawals_userId_status_idx" ON "withdrawals"("userId", "status");

-- CreateIndex
CREATE INDEX "withdrawals_status_createdAt_idx" ON "withdrawals"("status", "createdAt");

-- CreateIndex
CREATE INDEX "coin_packages_isActive_idx" ON "coin_packages"("isActive");

-- CreateIndex
CREATE INDEX "subscription_plans_isActive_idx" ON "subscription_plans"("isActive");

-- CreateIndex
CREATE INDEX "subscriptions_userId_isActive_idx" ON "subscriptions"("userId", "isActive");

-- CreateIndex
CREATE INDEX "subscriptions_endDate_idx" ON "subscriptions"("endDate");

-- CreateIndex
CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");

-- CreateIndex
CREATE INDEX "promo_codes_code_isActive_idx" ON "promo_codes"("code", "isActive");

-- CreateIndex
CREATE INDEX "promo_usages_userId_promoId_idx" ON "promo_usages"("userId", "promoId");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_referredId_key" ON "referrals"("referredId");

-- CreateIndex
CREATE INDEX "referrals_referrerId_idx" ON "referrals"("referrerId");

-- CreateIndex
CREATE INDEX "referrals_status_idx" ON "referrals"("status");

-- CreateIndex
CREATE INDEX "chats_lastMessageAt_idx" ON "chats"("lastMessageAt");

-- CreateIndex
CREATE INDEX "chat_participants_userId_idx" ON "chat_participants"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_participants_chatId_userId_key" ON "chat_participants"("chatId", "userId");

-- CreateIndex
CREATE INDEX "messages_chatId_createdAt_idx" ON "messages"("chatId", "createdAt");

-- CreateIndex
CREATE INDEX "messages_senderId_idx" ON "messages"("senderId");

-- CreateIndex
CREATE UNIQUE INDEX "message_reactions_messageId_userId_key" ON "message_reactions"("messageId", "userId");

-- CreateIndex
CREATE INDEX "calls_callerId_createdAt_idx" ON "calls"("callerId", "createdAt");

-- CreateIndex
CREATE INDEX "calls_receiverId_createdAt_idx" ON "calls"("receiverId", "createdAt");

-- CreateIndex
CREATE INDEX "calls_status_idx" ON "calls"("status");

-- CreateIndex
CREATE INDEX "gifts_isActive_idx" ON "gifts"("isActive");

-- CreateIndex
CREATE INDEX "gift_transactions_senderId_createdAt_idx" ON "gift_transactions"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "gift_transactions_receiverId_createdAt_idx" ON "gift_transactions"("receiverId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "reports_reporterId_idx" ON "reports"("reporterId");

-- CreateIndex
CREATE INDEX "reports_reportedId_idx" ON "reports"("reportedId");

-- CreateIndex
CREATE INDEX "reports_status_priority_idx" ON "reports"("status", "priority");

-- CreateIndex
CREATE INDEX "blocked_users_userId_idx" ON "blocked_users"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "blocked_users_userId_blockedId_key" ON "blocked_users"("userId", "blockedId");

-- CreateIndex
CREATE INDEX "favorites_userId_idx" ON "favorites"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_userId_favoriteId_key" ON "favorites"("userId", "favoriteId");

-- CreateIndex
CREATE INDEX "reviews_reviewedId_idx" ON "reviews"("reviewedId");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_ticketNumber_key" ON "support_tickets"("ticketNumber");

-- CreateIndex
CREATE INDEX "support_tickets_userId_idx" ON "support_tickets"("userId");

-- CreateIndex
CREATE INDEX "support_tickets_status_priority_idx" ON "support_tickets"("status", "priority");

-- CreateIndex
CREATE INDEX "support_messages_ticketId_idx" ON "support_messages"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- CreateIndex
CREATE INDEX "settings_category_idx" ON "settings"("category");

-- CreateIndex
CREATE INDEX "banners_isActive_idx" ON "banners"("isActive");

-- CreateIndex
CREATE INDEX "app_versions_platform_isLatest_idx" ON "app_versions"("platform", "isLatest");

-- CreateIndex
CREATE UNIQUE INDEX "app_versions_platform_version_key" ON "app_versions"("platform", "version");

-- CreateIndex
CREATE INDEX "auth_logs_userId_createdAt_idx" ON "auth_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "auth_logs_phone_createdAt_idx" ON "auth_logs"("phone", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_resource_resourceId_idx" ON "audit_logs"("resource", "resourceId");

-- AddForeignKey
ALTER TABLE "girls" ADD CONSTRAINT "girls_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admins" ADD CONSTRAINT "admins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_login_history" ADD CONSTRAINT "admin_login_history_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_usages" ADD CONSTRAINT "promo_usages_promoId_fkey" FOREIGN KEY ("promoId") REFERENCES "promo_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_usages" ADD CONSTRAINT "promo_usages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referredId_fkey" FOREIGN KEY ("referredId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_participants" ADD CONSTRAINT "chat_participants_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_participants" ADD CONSTRAINT "chat_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_callerId_fkey" FOREIGN KEY ("callerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_transactions" ADD CONSTRAINT "gift_transactions_giftId_fkey" FOREIGN KEY ("giftId") REFERENCES "gifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_transactions" ADD CONSTRAINT "gift_transactions_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_transactions" ADD CONSTRAINT "gift_transactions_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reportedId_fkey" FOREIGN KEY ("reportedId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocked_users" ADD CONSTRAINT "blocked_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocked_users" ADD CONSTRAINT "blocked_users_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_favoriteId_fkey" FOREIGN KEY ("favoriteId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewedId_fkey" FOREIGN KEY ("reviewedId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_logs" ADD CONSTRAINT "auth_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
