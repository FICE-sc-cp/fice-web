-- AlterTable
ALTER TABLE "Shara" ALTER COLUMN "group" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ShariAward" ADD COLUMN     "group" VARCHAR(20);

-- CreateTable
CREATE TABLE "ShariElectiveStudent" (
    "discipline" VARCHAR(255) NOT NULL,
    "group" VARCHAR(20) NOT NULL,
    "fullName" VARCHAR(120) NOT NULL,

    CONSTRAINT "ShariElectiveStudent_pkey" PRIMARY KEY ("discipline","group","fullName")
);
