-- AlterTable
ALTER TABLE "User" ADD COLUMN "phone" VARCHAR(20);

-- CreateTable
CREATE TABLE "PhoneView" (
    "id" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhoneView_viewerId_createdAt_idx" ON "PhoneView"("viewerId", "createdAt");

-- CreateIndex
CREATE INDEX "PhoneView_ownerId_createdAt_idx" ON "PhoneView"("ownerId", "createdAt");

-- AddForeignKey
ALTER TABLE "PhoneView" ADD CONSTRAINT "PhoneView_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneView" ADD CONSTRAINT "PhoneView_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
