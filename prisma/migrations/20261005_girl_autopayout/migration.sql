-- Add auto-payout fields to girls table
ALTER TABLE "girls" 
  ADD COLUMN IF NOT EXISTS "lastPayoutAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastPayoutAmount" DOUBLE PRECISION;