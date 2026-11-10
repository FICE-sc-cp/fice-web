-- CreateEnum
CREATE TYPE "QuestionFileKind" AS ENUM ('IMAGE', 'VIDEO', 'PDF', 'WORD');

-- AlterEnum
ALTER TYPE "EventQuestionType" ADD VALUE 'FILE';

-- AlterTable
ALTER TABLE "EventQuestion" ADD COLUMN     "fileKinds" "QuestionFileKind"[] DEFAULT ARRAY[]::"QuestionFileKind"[],
ADD COLUMN     "maxFiles" INTEGER NOT NULL DEFAULT 1;
