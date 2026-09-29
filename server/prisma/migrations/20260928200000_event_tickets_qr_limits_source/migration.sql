-- CreateEnum
CREATE TYPE "RegistrationSource" AS ENUM ('WEB', 'BOT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'CONFIRMED', 'REJECTED');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN "maxRegistrations" INTEGER;

-- AlterTable
ALTER TABLE "EventRegistration" ADD COLUMN "paymentRejectionReason" TEXT,
ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN "source" "RegistrationSource" NOT NULL DEFAULT 'WEB',
ADD COLUMN "ticketCode" UUID;

-- Backfill ticketCode for any existing registrations
UPDATE "EventRegistration" SET "ticketCode" = gen_random_uuid() WHERE "ticketCode" IS NULL;

-- Make ticketCode NOT NULL and default gen_random_uuid()
ALTER TABLE "EventRegistration" ALTER COLUMN "ticketCode" SET DEFAULT gen_random_uuid();
ALTER TABLE "EventRegistration" ALTER COLUMN "ticketCode" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "EventRegistration_ticketCode_key" ON "EventRegistration"("ticketCode");

-- CreateIndex
CREATE INDEX "EventRegistration_ticketCode_idx" ON "EventRegistration"("ticketCode");

-- CreateIndex
CREATE INDEX "EventRegistration_paymentStatus_idx" ON "EventRegistration"("paymentStatus");
