-- CreateEnum
CREATE TYPE "BroadcastStatus" AS ENUM ('SENDING', 'COMPLETED', 'INTERRUPTED');

-- AlterTable
ALTER TABLE "BroadcastMessage" ADD COLUMN "finishedAt" TIMESTAMP(3),
ADD COLUMN "status" "BroadcastStatus" NOT NULL DEFAULT 'COMPLETED';
