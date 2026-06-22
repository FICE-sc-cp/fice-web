-- AlterTable
ALTER TABLE "News" ADD COLUMN     "registrationLink" TEXT;

-- AlterTable
ALTER TABLE "EventPartner" ADD COLUMN     "logoImage" TEXT,
ADD COLUMN     "name" VARCHAR(60),
ADD COLUMN     "websiteLink" TEXT,
ALTER COLUMN "partnerId" DROP NOT NULL;
