-- CreateTable
CREATE TABLE "UpcomingSet" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "releaseDate" TIMESTAMP(3) NOT NULL,
    "cardCount" INTEGER,
    "jaName" TEXT,
    "jaSetId" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "arrivedSetId" TEXT,
    "arrivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UpcomingSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UpcomingSubscription" (
    "userId" TEXT NOT NULL,
    "upcomingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UpcomingSubscription_pkey" PRIMARY KEY ("userId","upcomingId")
);

-- CreateIndex
CREATE UNIQUE INDEX "UpcomingSet_slug_key" ON "UpcomingSet"("slug");

-- CreateIndex
CREATE INDEX "UpcomingSet_releaseDate_idx" ON "UpcomingSet"("releaseDate");

-- AddForeignKey
ALTER TABLE "UpcomingSubscription" ADD CONSTRAINT "UpcomingSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpcomingSubscription" ADD CONSTRAINT "UpcomingSubscription_upcomingId_fkey" FOREIGN KEY ("upcomingId") REFERENCES "UpcomingSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
