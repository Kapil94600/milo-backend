-- AlterTable
ALTER TABLE "coin_packages" ADD COLUMN "googlePlayProductId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "coin_packages_googlePlayProductId_key" ON "coin_packages"("googlePlayProductId");