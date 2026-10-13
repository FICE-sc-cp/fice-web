-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'NO_SHOW');

-- AlterTable
ALTER TABLE "Department" ADD COLUMN     "interviewSlotMinutes" INTEGER NOT NULL DEFAULT 30;

-- CreateTable
CREATE TABLE "InterviewRecruiter" (
    "id" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "telegramTag" VARCHAR(50) NOT NULL,
    "telegramId" BIGINT,
    "name" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewRecruiter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewCandidate" (
    "id" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "telegramTag" VARCHAR(50) NOT NULL,
    "telegramId" BIGINT,
    "name" VARCHAR(120),
    "applicantId" UUID,
    "status" "InterviewStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewSlot" (
    "id" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "hostTelegramId" BIGINT NOT NULL,
    "hostName" VARCHAR(120) NOT NULL,
    "candidateId" UUID,
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewNote" (
    "id" UUID NOT NULL,
    "candidateId" UUID NOT NULL,
    "authorTelegramId" BIGINT NOT NULL,
    "authorName" VARCHAR(120) NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InterviewRecruiter_telegramId_idx" ON "InterviewRecruiter"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewRecruiter_departmentId_telegramTag_key" ON "InterviewRecruiter"("departmentId", "telegramTag");

-- CreateIndex
CREATE INDEX "InterviewCandidate_telegramId_idx" ON "InterviewCandidate"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewCandidate_departmentId_telegramTag_key" ON "InterviewCandidate"("departmentId", "telegramTag");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewSlot_candidateId_key" ON "InterviewSlot"("candidateId");

-- CreateIndex
CREATE INDEX "InterviewSlot_departmentId_startsAt_idx" ON "InterviewSlot"("departmentId", "startsAt");

-- CreateIndex
CREATE INDEX "InterviewSlot_hostTelegramId_startsAt_idx" ON "InterviewSlot"("hostTelegramId", "startsAt");

-- CreateIndex
CREATE INDEX "InterviewNote_candidateId_idx" ON "InterviewNote"("candidateId");

-- AddForeignKey
ALTER TABLE "InterviewRecruiter" ADD CONSTRAINT "InterviewRecruiter_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewCandidate" ADD CONSTRAINT "InterviewCandidate_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewCandidate" ADD CONSTRAINT "InterviewCandidate_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewSlot" ADD CONSTRAINT "InterviewSlot_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewSlot" ADD CONSTRAINT "InterviewSlot_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "InterviewCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewNote" ADD CONSTRAINT "InterviewNote_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "InterviewCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
