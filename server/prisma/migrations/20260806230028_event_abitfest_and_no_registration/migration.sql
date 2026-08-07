-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "isAbitfest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "noRegistration" BOOLEAN NOT NULL DEFAULT false;
