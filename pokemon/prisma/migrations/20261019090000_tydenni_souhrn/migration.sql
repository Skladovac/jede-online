-- Týdenní e-mailový souhrn.
ALTER TABLE "User" ADD COLUMN "weeklyEmails" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "weeklyDigestAt" TIMESTAMP(3);
