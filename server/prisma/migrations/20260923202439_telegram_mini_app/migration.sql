-- CreateEnum
CREATE TYPE "VotingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('APPROVED', 'PENDING', 'REJECTED');

-- CreateEnum
CREATE TYPE "BroadcastTarget" AS ENUM ('EVENT_PARTICIPANTS', 'ALL_BOT_USERS');

-- AlterEnum
ALTER TYPE "FundraiserStatus" ADD VALUE 'DRAFT';

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "allowedFaculties" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "baseQuestionsConfig" JSONB,
ADD COLUMN     "checkInStaffTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "hasTime" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isDraft" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "time" VARCHAR(10);

-- AlterTable
ALTER TABLE "EventRegistration" ADD COLUMN     "attended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "attendedAt" TIMESTAMP(3),
ADD COLUMN     "attendedBy" VARCHAR(100),
ADD COLUMN     "botUserId" UUID,
ADD COLUMN     "telegramUserId" BIGINT;

-- AlterTable
ALTER TABLE "News" ADD COLUMN     "isDraft" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "BlockedUser" (
    "id" UUID NOT NULL,
    "telegramTag" VARCHAR(50) NOT NULL,
    "telegramUserId" BIGINT,
    "group" VARCHAR(20),
    "faculty" VARCHAR(50),
    "reason" TEXT,
    "isBlocked" BOOLEAN NOT NULL DEFAULT true,
    "blockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlockedUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingWebRegistration" (
    "id" UUID NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "eventId" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "telegramTag" VARCHAR(50) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingWebRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotUser" (
    "id" UUID NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "chatId" BIGINT NOT NULL,
    "username" VARCHAR(50),
    "firstName" VARCHAR(100),
    "lastName" VARCHAR(100),
    "fullName" VARCHAR(120),
    "group" VARCHAR(10),
    "birthDate" TIMESTAMP(3),
    "phoneNumber" VARCHAR(20),
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventVoting" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "status" "VotingStatus" NOT NULL DEFAULT 'DRAFT',
    "onlyRegistered" BOOLEAN NOT NULL DEFAULT true,
    "showResultsLive" BOOLEAN NOT NULL DEFAULT false,
    "allowChangeVote" BOOLEAN NOT NULL DEFAULT false,
    "allowSubmissions" BOOLEAN NOT NULL DEFAULT false,
    "submissionsOpen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventVoting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VotingCandidate" (
    "id" UUID NOT NULL,
    "votingId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "photoUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "status" "CandidateStatus" NOT NULL DEFAULT 'APPROVED',
    "submittedByTelegramId" BIGINT,
    "submittedByName" VARCHAR(120),
    "submittedByTag" VARCHAR(60),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VotingCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" UUID NOT NULL,
    "votingId" UUID NOT NULL,
    "candidateId" UUID NOT NULL,
    "botUserId" UUID,
    "telegramId" BIGINT NOT NULL,
    "registrationId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BroadcastMessage" (
    "id" UUID NOT NULL,
    "eventId" UUID,
    "target" "BroadcastTarget" NOT NULL DEFAULT 'EVENT_PARTICIPANTS',
    "text" TEXT NOT NULL,
    "imageUrl" TEXT,
    "buttonText" VARCHAR(60),
    "buttonUrl" TEXT,
    "recipientsCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BroadcastMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlockedUser_telegramTag_key" ON "BlockedUser"("telegramTag");

-- CreateIndex
CREATE UNIQUE INDEX "PendingWebRegistration_token_key" ON "PendingWebRegistration"("token");

-- CreateIndex
CREATE INDEX "PendingWebRegistration_token_idx" ON "PendingWebRegistration"("token");

-- CreateIndex
CREATE INDEX "PendingWebRegistration_telegramTag_idx" ON "PendingWebRegistration"("telegramTag");

-- CreateIndex
CREATE UNIQUE INDEX "BotUser_telegramId_key" ON "BotUser"("telegramId");

-- CreateIndex
CREATE INDEX "EventVoting_eventId_idx" ON "EventVoting"("eventId");

-- CreateIndex
CREATE INDEX "VotingCandidate_votingId_idx" ON "VotingCandidate"("votingId");

-- CreateIndex
CREATE INDEX "VotingCandidate_submittedByTelegramId_idx" ON "VotingCandidate"("submittedByTelegramId");

-- CreateIndex
CREATE INDEX "Vote_candidateId_idx" ON "Vote"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_votingId_telegramId_key" ON "Vote"("votingId", "telegramId");

-- CreateIndex
CREATE INDEX "BroadcastMessage_eventId_idx" ON "BroadcastMessage"("eventId");

-- CreateIndex
CREATE INDEX "EventRegistration_eventId_idx" ON "EventRegistration"("eventId");

-- CreateIndex
CREATE INDEX "EventRegistration_telegramUserId_idx" ON "EventRegistration"("telegramUserId");

-- CreateIndex
CREATE INDEX "EventRegistration_attended_idx" ON "EventRegistration"("attended");

-- AddForeignKey
ALTER TABLE "PendingWebRegistration" ADD CONSTRAINT "PendingWebRegistration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_botUserId_fkey" FOREIGN KEY ("botUserId") REFERENCES "BotUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventVoting" ADD CONSTRAINT "EventVoting_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotingCandidate" ADD CONSTRAINT "VotingCandidate_votingId_fkey" FOREIGN KEY ("votingId") REFERENCES "EventVoting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_votingId_fkey" FOREIGN KEY ("votingId") REFERENCES "EventVoting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "VotingCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_botUserId_fkey" FOREIGN KEY ("botUserId") REFERENCES "BotUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "EventRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastMessage" ADD CONSTRAINT "BroadcastMessage_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
