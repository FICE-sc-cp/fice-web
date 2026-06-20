-- CreateEnum
CREATE TYPE "NewsCategory" AS ENUM ('EVENTS', 'EDUCATION', 'PARTNERS', 'CHARITY', 'ACHIEVEMENTS');

-- AlterTable
ALTER TABLE "News" ADD COLUMN     "category" "NewsCategory",
ADD COLUMN     "eventDate" TIMESTAMP(3),
ADD COLUMN     "eventLocation" VARCHAR(100);
