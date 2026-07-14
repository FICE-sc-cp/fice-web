/*
  Warnings:

  - You are about to drop the column `detailsId` on the `Department` table. All the data in the column will be lost.
  - You are about to drop the column `shortDescription` on the `Department` table. All the data in the column will be lost.
  - You are about to drop the column `quote` on the `DepartmentMember` table. All the data in the column will be lost.
  - You are about to drop the column `shortDescription` on the `Partner` table. All the data in the column will be lost.
  - You are about to drop the `DepartmentDetails` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ProjectParticipantSource" AS ENUM ('HARVESTED', 'MANUAL');

-- DropForeignKey
ALTER TABLE "Department" DROP CONSTRAINT "Department_detailsId_fkey";

-- DropIndex
DROP INDEX "Department_detailsId_key";

-- AlterTable
ALTER TABLE "Department" DROP COLUMN "detailsId",
DROP COLUMN "shortDescription";

-- AlterTable
ALTER TABLE "DepartmentMember" DROP COLUMN "quote";

-- AlterTable
ALTER TABLE "Partner" DROP COLUMN "shortDescription";

-- DropTable
DROP TABLE "DepartmentDetails";

-- CreateTable
CREATE TABLE "ProjectParticipant" (
    "id" UUID NOT NULL,
    "telegramId" BIGINT,
    "fullName" VARCHAR(120) NOT NULL,
    "telegramTag" VARCHAR(50),
    "photo" TEXT,
    "avatarFileId" TEXT,
    "source" "ProjectParticipantSource" NOT NULL DEFAULT 'HARVESTED',
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectParticipant_telegramId_key" ON "ProjectParticipant"("telegramId");
