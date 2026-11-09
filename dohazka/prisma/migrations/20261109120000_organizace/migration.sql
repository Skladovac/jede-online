-- Organizace, clenstvi a uzaverky.
-- POZOR NA PORADI: Entry.userId a sloupce User.periodStartDay/remindHour/tracksFrom
-- se smi zahodit az PO prevodu zivych dat (viz oddil 3 a 4). Prisma toto poradi
-- nevymysli, je psane rucne. Cele to bezi v jedne transakci (jedno vicepikazove
-- spusteni), takze selhani kdekoli vrati stav pred migraci.

-- 1) Nove struktury (zadna data se nemeni)
CREATE TYPE "Role" AS ENUM ('OWNER', 'ACCOUNTANT', 'EMPLOYEE');

CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reportName" TEXT NOT NULL,
    "periodStartDay" INTEGER NOT NULL DEFAULT 1,
    "remindHour" INTEGER NOT NULL DEFAULT 19,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "tracksFrom" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PeriodLock" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "lockedById" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeriodLock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EntryChangeLog" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "before" JSONB,
    "after" JSONB,

    CONSTRAINT "EntryChangeLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "User" ADD COLUMN "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Entry.membershipId zatim NULLABLE, aby sel pridat do tabulky s radky.
ALTER TABLE "Entry" ADD COLUMN "membershipId" TEXT;

-- 2) Prevod zivych dat. Vsechno, co cte User.tracksFrom/periodStartDay/remindHour
--    a Entry.userId, musi probehnout TADY, dokud ty sloupce existuji.
--    Vychozi firma prevezme nastaveni nejstarsiho uzivatele (v provozu je jediny),
--    aby se zmenou schematu tise neprepsalo jeho obdobi vykazu (napr. 16.-15.).
INSERT INTO "Organization" (id, name, "reportName", "periodStartDay", "remindHour", "createdAt")
SELECT 'org_default', 'Výchozí firma', 'Výchozí firma', u."periodStartDay", u."remindHour", now()
FROM "User" u
ORDER BY u."createdAt", u.id
LIMIT 1;

INSERT INTO "Membership" (id, "userId", "orgId", role, active, "tracksFrom", "createdAt")
SELECT 'mem_' || u.id, u.id, 'org_default', 'EMPLOYEE', true, u."tracksFrom", now() FROM "User" u;

UPDATE "Entry" e SET "membershipId" = 'mem_' || e."userId";

-- 3) Pojistka: kdyby jakykoli zaznam zustal bez clenstvi, migrace spadne a vse se vrati.
ALTER TABLE "Entry" ALTER COLUMN "membershipId" SET NOT NULL;

-- 4) Az ted se stare sloupce a vazby zahodi.
ALTER TABLE "Entry" DROP CONSTRAINT "Entry_userId_fkey";
DROP INDEX "Entry_userId_day_idx";
ALTER TABLE "Entry" DROP COLUMN "userId";

ALTER TABLE "User" DROP COLUMN "periodStartDay",
DROP COLUMN "remindHour",
DROP COLUMN "tracksFrom";

-- 5) Indexy a cizi klice
CREATE INDEX "Membership_orgId_idx" ON "Membership"("orgId");
CREATE UNIQUE INDEX "Membership_userId_orgId_key" ON "Membership"("userId", "orgId");
CREATE UNIQUE INDEX "PeriodLock_orgId_periodKey_key" ON "PeriodLock"("orgId", "periodKey");
CREATE INDEX "EntryChangeLog_membershipId_dayKey_idx" ON "EntryChangeLog"("membershipId", "dayKey");
CREATE UNIQUE INDEX "Invitation_membershipId_key" ON "Invitation"("membershipId");
CREATE INDEX "Entry_membershipId_day_idx" ON "Entry"("membershipId", "day");

ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PeriodLock" ADD CONSTRAINT "PeriodLock_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EntryChangeLog" ADD CONSTRAINT "EntryChangeLog_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
