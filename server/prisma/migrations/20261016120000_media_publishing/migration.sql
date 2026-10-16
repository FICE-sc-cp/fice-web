-- CreateEnum
CREATE TYPE "ChannelPostStatus" AS ENUM ('PENDING', 'SCHEDULED', 'PUBLISHED', 'FAILED');

-- AlterTable
ALTER TABLE "News" ADD COLUMN     "buttonText" VARCHAR(64);

-- CreateTable
CREATE TABLE "ChannelPost" (
    "id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "imageUrl" TEXT,
    "mediaFileId" TEXT,
    "mediaType" VARCHAR(16),
    "buttonText" VARCHAR(64),
    "buttonUrl" TEXT,
    "publishAt" TIMESTAMP(3) NOT NULL,
    "status" "ChannelPostStatus" NOT NULL DEFAULT 'SCHEDULED',
    "messageId" INTEGER,
    "error" TEXT,
    "author" VARCHAR(100),
    "sourceMessageId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Publisher" (
    "telegramTag" VARCHAR(50) NOT NULL,
    "addedBy" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Publisher_pkey" PRIMARY KEY ("telegramTag")
);

-- CreateIndex
CREATE INDEX "ChannelPost_status_publishAt_idx" ON "ChannelPost"("status", "publishAt");

