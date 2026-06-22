-- AlterTable
ALTER TABLE "Fundraiser" ADD COLUMN     "cardNumber" VARCHAR(25),
ADD COLUMN     "donationsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "jarUrl" TEXT,
ADD COLUMN     "location" VARCHAR(100),
ADD COLUMN     "monoJarId" VARCHAR(40),
ADD COLUMN     "story" TEXT,
ALTER COLUMN "name" SET DATA TYPE VARCHAR(120);

-- CreateTable
CREATE TABLE "Donation" (
    "id" UUID NOT NULL,
    "fundraiserId" UUID NOT NULL,
    "name" VARCHAR(60),
    "amount" DECIMAL(10,2) NOT NULL,
    "comment" VARCHAR(160),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "externalId" VARCHAR(64),

    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Donation_fundraiserId_createdAt_idx" ON "Donation"("fundraiserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Donation_fundraiserId_externalId_key" ON "Donation"("fundraiserId", "externalId");

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_fundraiserId_fkey" FOREIGN KEY ("fundraiserId") REFERENCES "Fundraiser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
