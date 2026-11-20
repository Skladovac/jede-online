-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avgSaleDays" INTEGER,
ADD COLUMN     "soldCount" INTEGER,
ADD COLUMN     "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "story" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "videoUrl" TEXT,
ADD COLUMN     "yearsInField" INTEGER;

-- CreateTable
CREATE TABLE "TeamSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "yearsInField" INTEGER,
    "soldCount" INTEGER,
    "avgSaleDays" INTEGER,
    "story" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "TeamSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Testimonial" (
    "id" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientPlace" TEXT NOT NULL DEFAULT '',
    "propertyLabel" TEXT NOT NULL DEFAULT '',
    "agentId" TEXT,
    "listingId" TEXT,
    "consent" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Testimonial_published_sort_idx" ON "Testimonial"("published", "sort");

-- AddForeignKey
ALTER TABLE "Testimonial" ADD CONSTRAINT "Testimonial_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Testimonial" ADD CONSTRAINT "Testimonial_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

