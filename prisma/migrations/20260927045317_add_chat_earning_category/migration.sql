-- AlterEnum
ALTER TYPE "TransactionCategory" ADD VALUE 'CHAT_EARNING';

-- AlterTable
ALTER TABLE "coin_packages" ADD COLUMN     "image" TEXT;
