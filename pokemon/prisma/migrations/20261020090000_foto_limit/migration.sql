-- CreateTable
CREATE TABLE "PhotoScan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoScan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhotoScan_userId_createdAt_idx" ON "PhotoScan"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PhotoScan_createdAt_idx" ON "PhotoScan"("createdAt");

-- AddForeignKey
ALTER TABLE "PhotoScan" ADD CONSTRAINT "PhotoScan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
