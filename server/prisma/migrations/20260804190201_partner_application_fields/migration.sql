-- AlterTable
ALTER TABLE "Partner" ADD COLUMN     "contactMethod" VARCHAR(150),
ADD COLUMN     "contactName" VARCHAR(100),
ADD COLUMN     "proposal" TEXT,
ALTER COLUMN "name" SET DATA TYPE VARCHAR(100);
