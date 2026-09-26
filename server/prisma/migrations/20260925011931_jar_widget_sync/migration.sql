-- DropForeignKey
ALTER TABLE "Donation" DROP CONSTRAINT "Donation_fundraiserId_fkey";

-- AlterTable
ALTER TABLE "Fundraiser" DROP COLUMN "donationsCount",
DROP COLUMN "monoJarId",
ADD COLUMN     "jarSyncError" VARCHAR(255),
ADD COLUMN     "jarSyncedAt" TIMESTAMP(3),
ADD COLUMN     "jarWidgetUrl" VARCHAR(500),
ALTER COLUMN "goalAmount" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "currentAmount" SET DATA TYPE DECIMAL(14,2);

-- DropTable
DROP TABLE "Donation";

