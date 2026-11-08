-- CreateEnum
CREATE TYPE "SetGoal" AS ENUM ('BASE', 'COMPLETE', 'MASTER');

-- CreateTable
CREATE TABLE "SetGoalChoice" (
    "userId" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "goal" "SetGoal" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SetGoalChoice_pkey" PRIMARY KEY ("userId","setId")
);

-- AddForeignKey
ALTER TABLE "SetGoalChoice" ADD CONSTRAINT "SetGoalChoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetGoalChoice" ADD CONSTRAINT "SetGoalChoice_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CardSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
