-- CreateEnum
CREATE TYPE "EventQuestionType" AS ENUM ('SHORT_TEXT', 'LONG_TEXT', 'SINGLE_CHOICE', 'YES_NO');

-- CreateEnum
CREATE TYPE "RegistrationPayment" AS ENUM ('NONE', 'DONATED', 'AT_EVENT');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "description" TEXT,
ADD COLUMN     "feeAmount" DECIMAL(10,2),
ADD COLUMN     "feeRequisites" VARCHAR(255),
ADD COLUMN     "location" VARCHAR(120),
ADD COLUMN     "locationNote" VARCHAR(120),
ADD COLUMN     "photoAlbumUrl" TEXT,
ADD COLUMN     "registrationCloseDate" TIMESTAMP(3),
ADD COLUMN     "timeNote" VARCHAR(120);

-- CreateTable
CREATE TABLE "EventProgramItem" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "time" VARCHAR(20) NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EventProgramItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventQuestion" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "type" "EventQuestionType" NOT NULL DEFAULT 'SHORT_TEXT',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" TEXT[],
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EventQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventRegistration" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "fullName" VARCHAR(100) NOT NULL,
    "telegramTag" VARCHAR(50) NOT NULL,
    "group" VARCHAR(10) NOT NULL,
    "birthDate" TIMESTAMP(3),
    "payment" "RegistrationPayment" NOT NULL DEFAULT 'NONE',
    "receiptUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventRegistrationAnswer" (
    "id" UUID NOT NULL,
    "registrationId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "EventRegistrationAnswer_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "EventProgramItem" ADD CONSTRAINT "EventProgramItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventQuestion" ADD CONSTRAINT "EventQuestion_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegistrationAnswer" ADD CONSTRAINT "EventRegistrationAnswer_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "EventRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegistrationAnswer" ADD CONSTRAINT "EventRegistrationAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "EventQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
