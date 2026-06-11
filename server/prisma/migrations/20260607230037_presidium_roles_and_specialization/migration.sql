-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DepartmentMemberRole" ADD VALUE 'FIRST_DEPUTY';
ALTER TYPE "DepartmentMemberRole" ADD VALUE 'SECRETARY';

-- AlterTable
ALTER TABLE "DepartmentMember" ADD COLUMN     "specialization" VARCHAR(100);
