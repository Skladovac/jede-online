-- AlterTable
ALTER TABLE "User" ADD COLUMN "matchEmails" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "matchDigestAt" TIMESTAMP(3);
