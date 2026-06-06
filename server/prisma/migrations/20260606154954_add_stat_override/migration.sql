-- CreateTable
CREATE TABLE "StatOverride" (
    "key" VARCHAR(50) NOT NULL,
    "value" DECIMAL(14,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatOverride_pkey" PRIMARY KEY ("key")
);
