-- CreateTable
CREATE TABLE "ShariAdmin" (
    "telegramTag" VARCHAR(50) NOT NULL,
    "telegramId" BIGINT,
    "addedBy" VARCHAR(120) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShariAdmin_pkey" PRIMARY KEY ("telegramTag")
);
