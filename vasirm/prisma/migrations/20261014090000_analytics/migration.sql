-- CreateTable
CREATE TABLE "PageStat" (
    "day" DATE NOT NULL,
    "path" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PageStat_pkey" PRIMARY KEY ("day","path")
);

-- CreateTable
CREATE TABLE "VisitorDay" (
    "day" DATE NOT NULL,
    "hash" CHAR(64) NOT NULL,

    CONSTRAINT "VisitorDay_pkey" PRIMARY KEY ("day","hash")
);

-- CreateTable
CREATE TABLE "SourceStat" (
    "day" DATE NOT NULL,
    "source" TEXT NOT NULL,
    "visits" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SourceStat_pkey" PRIMARY KEY ("day","source")
);

