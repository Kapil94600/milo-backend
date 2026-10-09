-- ============================================
-- Migration: Add Girl Rates + Platform Commission
-- Created: 2026-01-05
-- ============================================

-- ============================================
-- Add new rate columns to girls table
-- ============================================
ALTER TABLE "girls" 
  ADD COLUMN IF NOT EXISTS "videoCallRate" DOUBLE PRECISION NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS "chatMessageRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "rateApproved" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "pendingHourlyRate" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "pendingVideoRate" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "pendingChatRate" DOUBLE PRECISION;

-- ============================================
-- Add rate columns to girl_requests table
-- ============================================
ALTER TABLE "girl_requests"
  ADD COLUMN IF NOT EXISTS "videoCallRate" DOUBLE PRECISION NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS "chatMessageRate" DOUBLE PRECISION NOT NULL DEFAULT 1;

-- ============================================
-- Add indexes for rate filtering/sorting
-- ============================================
CREATE INDEX IF NOT EXISTS "girls_hourlyRate_idx" ON "girls"("hourlyRate");
CREATE INDEX IF NOT EXISTS "girls_videoCallRate_idx" ON "girls"("videoCallRate");
CREATE INDEX IF NOT EXISTS "girls_rateApproved_idx" ON "girls"("rateApproved");

-- ============================================
-- Insert new settings if not exist
-- ============================================

-- Chat costs
INSERT INTO "settings" ("id", "key", "value", "type", "category", "description", "isEditable", "createdAt", "updatedAt")
VALUES 
  (gen_random_uuid()::text, 'CHAT_MESSAGE_COST', '1'::jsonb, 'NUMBER', 'COINS', 'Default coins per text message', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'CHAT_MEDIA_COST', '5'::jsonb, 'NUMBER', 'COINS', 'Default coins per media message', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'CHAT_GIRL_EARNING_PERCENT', '50'::jsonb, 'NUMBER', 'COINS', 'Percentage of chat coins girl receives', true, NOW(), NOW())
ON CONFLICT ("key") DO NOTHING;

-- Call rates
INSERT INTO "settings" ("id", "key", "value", "type", "category", "description", "isEditable", "createdAt", "updatedAt")
VALUES 
  (gen_random_uuid()::text, 'COIN_VOICE_COST_PER_MINUTE', '10'::jsonb, 'NUMBER', 'COINS', 'Default voice call rate per minute', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'COIN_VIDEO_COST_PER_MINUTE', '20'::jsonb, 'NUMBER', 'COINS', 'Default video call rate per minute', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'CALL_PLATFORM_COMMISSION', '50'::jsonb, 'NUMBER', 'CALLS', 'Platform commission % from calls', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'CALL_MIN_COINS_FOR_VIDEO', '50'::jsonb, 'NUMBER', 'CALLS', 'Minimum coins to unlock video calls', true, NOW(), NOW())
ON CONFLICT ("key") DO NOTHING;

-- ============================================
-- Migration complete
-- ============================================