-- Aktivita uživatelů (naposledy na webu, aktivní dny).
ALTER TABLE "User" ADD COLUMN "lastSeenAt" TIMESTAMP(3);

CREATE TABLE "UserActiveDay" (
    "day" DATE NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "UserActiveDay_pkey" PRIMARY KEY ("day", "userId")
);
ALTER TABLE "UserActiveDay" ADD CONSTRAINT "UserActiveDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
