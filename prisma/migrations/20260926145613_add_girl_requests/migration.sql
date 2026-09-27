-- CreateTable
CREATE TABLE "girl_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "about" TEXT NOT NULL,
    "categories" TEXT[],
    "languages" TEXT[],
    "specialties" TEXT[],
    "hourlyRate" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "girl_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "girl_requests_userId_key" ON "girl_requests"("userId");

-- CreateIndex
CREATE INDEX "girl_requests_userId_idx" ON "girl_requests"("userId");

-- CreateIndex
CREATE INDEX "girl_requests_status_idx" ON "girl_requests"("status");

-- CreateIndex
CREATE INDEX "girl_requests_createdAt_idx" ON "girl_requests"("createdAt");

-- AddForeignKey
ALTER TABLE "girl_requests" ADD CONSTRAINT "girl_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "girl_requests" ADD CONSTRAINT "girl_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
