-- Odznaky (sbírka, výměny, hodnocení, ověření, průkopník).
ALTER TABLE "User" ADD COLUMN "topBadge" VARCHAR(24);

CREATE TABLE "UserBadge" (
    "userId" TEXT NOT NULL,
    "badge" VARCHAR(20) NOT NULL,
    "level" INTEGER NOT NULL,
    "maxLevel" INTEGER NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("userId", "badge")
);
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
