-- CreateTable
CREATE TABLE "SiteSetting" (
    "key" VARCHAR(50) NOT NULL,
    "value" VARCHAR(200) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("key")
);
