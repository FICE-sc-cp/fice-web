/*
  Warnings:

  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `email` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `lastName` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[telegramTag]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `telegramTag` to the `User` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `id` on the `User` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "FundraiserStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "DepartmentMemberRole" AS ENUM ('DEPUTY', 'HR', 'HEAD', 'MEMBER');

-- DropIndex
DROP INDEX "User_email_key";

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
DROP COLUMN "email",
DROP COLUMN "lastName",
DROP COLUMN "name",
ADD COLUMN     "telegramTag" VARCHAR(50) NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "News" (
    "id" UUID NOT NULL,
    "title" VARCHAR(50) NOT NULL,
    "publishDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" TEXT,
    "image" TEXT,

    CONSTRAINT "News_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fundraiser" (
    "id" UUID NOT NULL,
    "name" VARCHAR(30) NOT NULL,
    "status" "FundraiserStatus" NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "goalAmount" DECIMAL(10,2) NOT NULL,
    "currentAmount" DECIMAL(10,2) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "detailsLink" TEXT,

    CONSTRAINT "Fundraiser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentHead" (
    "id" UUID NOT NULL,
    "firstName" VARCHAR(30) NOT NULL,
    "lastName" VARCHAR(30) NOT NULL,
    "photo" TEXT,
    "jobDescription" VARCHAR(100),
    "telegramTag" VARCHAR(50) NOT NULL,

    CONSTRAINT "DepartmentHead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentDetails" (
    "id" UUID NOT NULL,
    "about" TEXT NOT NULL,
    "detailedDescription" TEXT,
    "exampleOfWork" TEXT,

    CONSTRAINT "DepartmentDetails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "shortDescription" VARCHAR(100) NOT NULL,
    "headId" UUID,
    "detailsId" UUID,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentMember" (
    "id" UUID NOT NULL,
    "role" "DepartmentMemberRole" NOT NULL,
    "firstName" VARCHAR(30) NOT NULL,
    "lastName" VARCHAR(30) NOT NULL,

    CONSTRAINT "DepartmentMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentMemberAssignment" (
    "id" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "memberId" UUID NOT NULL,

    CONSTRAINT "DepartmentMemberAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Applicant" (
    "id" UUID NOT NULL,
    "firstName" VARCHAR(30) NOT NULL,
    "middleName" VARCHAR(30) NOT NULL,
    "lastName" VARCHAR(30) NOT NULL,
    "telegramTag" VARCHAR(50) NOT NULL,
    "group" VARCHAR(5) NOT NULL,
    "phoneNumber" VARCHAR(20) NOT NULL,
    "motivation" TEXT,
    "experience" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Applicant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicantDepartment" (
    "id" UUID NOT NULL,
    "applicantId" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "question" TEXT,

    CONSTRAINT "ApplicantDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventDetails" (
    "id" UUID NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "moneyCollected" DECIMAL(10,2) NOT NULL,
    "charityAmount" DECIMAL(10,2) NOT NULL,
    "visitorsAmount" INTEGER,
    "departmentId" UUID,

    CONSTRAINT "EventDetails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "photoUrl" TEXT,
    "detailsId" UUID,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" UUID NOT NULL,
    "name" VARCHAR(30) NOT NULL,
    "logoImage" TEXT,
    "websiteLink" TEXT,
    "shortDescription" VARCHAR(150),
    "isApproved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventPartner" (
    "id" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "eventId" UUID NOT NULL,

    CONSTRAINT "EventPartner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_headId_key" ON "Department"("headId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_detailsId_key" ON "Department"("detailsId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_detailsId_key" ON "Event"("detailsId");

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramTag_key" ON "User"("telegramTag");

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_headId_fkey" FOREIGN KEY ("headId") REFERENCES "DepartmentHead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_detailsId_fkey" FOREIGN KEY ("detailsId") REFERENCES "DepartmentDetails"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentMemberAssignment" ADD CONSTRAINT "DepartmentMemberAssignment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentMemberAssignment" ADD CONSTRAINT "DepartmentMemberAssignment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "DepartmentMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicantDepartment" ADD CONSTRAINT "ApplicantDepartment_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicantDepartment" ADD CONSTRAINT "ApplicantDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDetails" ADD CONSTRAINT "EventDetails_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_detailsId_fkey" FOREIGN KEY ("detailsId") REFERENCES "EventDetails"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventPartner" ADD CONSTRAINT "EventPartner_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventPartner" ADD CONSTRAINT "EventPartner_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
