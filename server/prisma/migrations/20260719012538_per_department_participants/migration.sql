-- DropIndex
DROP INDEX "ProjectParticipant_telegramId_key";

-- AlterTable
ALTER TABLE "Department" ADD COLUMN     "telegramChatId" VARCHAR(64);

-- AlterTable
ALTER TABLE "ProjectParticipant" ADD COLUMN     "departmentId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "ProjectParticipant_departmentId_telegramId_key" ON "ProjectParticipant"("departmentId", "telegramId");

-- AddForeignKey
ALTER TABLE "ProjectParticipant" ADD CONSTRAINT "ProjectParticipant_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
