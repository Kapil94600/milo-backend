-- ============================================
-- Migration: Add performance indexes
-- Created: 2026-10-05
-- ============================================

-- Messages
CREATE INDEX IF NOT EXISTS "messages_senderId_isRead_idx" 
  ON "messages"("senderId", "isRead");

CREATE INDEX IF NOT EXISTS "messages_chatId_isRead_idx" 
  ON "messages"("chatId", "isRead");

CREATE INDEX IF NOT EXISTS "messages_chatId_createdAt_desc_idx" 
  ON "messages"("chatId", "createdAt" DESC);

-- Transactions
CREATE INDEX IF NOT EXISTS "transactions_category_status_createdAt_idx" 
  ON "transactions"("category", "status", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "transactions_userId_createdAt_desc_idx" 
  ON "transactions"("userId", "createdAt" DESC);

-- Calls
CREATE INDEX IF NOT EXISTS "calls_callerId_status_idx" 
  ON "calls"("callerId", "status");

CREATE INDEX IF NOT EXISTS "calls_receiverId_status_idx" 
  ON "calls"("receiverId", "status");

CREATE INDEX IF NOT EXISTS "calls_status_createdAt_idx" 
  ON "calls"("status", "createdAt" DESC);

-- Withdrawals
CREATE INDEX IF NOT EXISTS "withdrawals_status_createdAt_desc_idx" 
  ON "withdrawals"("status", "createdAt" DESC);

-- Girls
CREATE INDEX IF NOT EXISTS "girls_rateApproved_idx" 
  ON "girls"("rateApproved") WHERE "rateApproved" = false;

CREATE INDEX IF NOT EXISTS "girls_isOnline_isAvailable_idx" 
  ON "girls"("isOnline", "isAvailable") 
  WHERE "deletedAt" IS NULL;

-- Notifications
CREATE INDEX IF NOT EXISTS "notifications_userId_isRead_createdAt_idx" 
  ON "notifications"("userId", "isRead", "createdAt" DESC);

-- Reports
CREATE INDEX IF NOT EXISTS "reports_status_priority_createdAt_idx" 
  ON "reports"("status", "priority", "createdAt" DESC);

-- Support Tickets
CREATE INDEX IF NOT EXISTS "support_tickets_status_priority_createdAt_idx" 
  ON "support_tickets"("status", "priority", "createdAt" DESC);

-- Promo Usage
CREATE INDEX IF NOT EXISTS "promo_usages_userId_promoId_idx" 
  ON "promo_usages"("userId", "promoId");

-- Referrals
CREATE INDEX IF NOT EXISTS "referrals_referrerId_status_idx" 
  ON "referrals"("referrerId", "status");

-- Soft delete
CREATE INDEX IF NOT EXISTS "users_deletedAt_idx" 
  ON "users"("deletedAt") WHERE "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "girls_deletedAt_idx" 
  ON "girls"("deletedAt") WHERE "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "transactions_deletedAt_idx" 
  ON "transactions"("deletedAt") WHERE "deletedAt" IS NULL;

-- OTPs cleanup
CREATE INDEX IF NOT EXISTS "otps_expiresAt_isUsed_idx" 
  ON "otps"("expiresAt", "isUsed");

-- Audit logs
CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_idx" 
  ON "audit_logs"("createdAt" DESC);

-- Subscriptions
CREATE INDEX IF NOT EXISTS "subscriptions_endDate_isActive_idx" 
  ON "subscriptions"("endDate", "isActive");