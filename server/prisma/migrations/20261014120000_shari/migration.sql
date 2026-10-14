-- CreateTable
CREATE TABLE "ShariTeacher" (
    "id" UUID NOT NULL,
    "fullName" VARCHAR(120) NOT NULL,
    "email" VARCHAR(255),
    "telegram" VARCHAR(120),
    "token" VARCHAR(64) NOT NULL,
    "courses" JSONB NOT NULL DEFAULT '[]',
    "openedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShariTeacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shara" (
    "id" UUID NOT NULL,
    "teacherId" UUID NOT NULL,
    "discipline" VARCHAR(255) NOT NULL,
    "group" VARCHAR(20) NOT NULL,
    "bonus" VARCHAR(300) NOT NULL,
    "condition" VARCHAR(300),
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Shara_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShariAward" (
    "id" UUID NOT NULL,
    "sharaId" UUID NOT NULL,
    "slot" INTEGER NOT NULL,
    "studentName" VARCHAR(120) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShariAward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShariStarosta" (
    "group" VARCHAR(20) NOT NULL,
    "telegramTag" VARCHAR(50) NOT NULL,
    "telegramId" BIGINT,

    CONSTRAINT "ShariStarosta_pkey" PRIMARY KEY ("group")
);

-- CreateTable
CREATE TABLE "ShariStudent" (
    "id" UUID NOT NULL,
    "group" VARCHAR(20) NOT NULL,
    "fullName" VARCHAR(120) NOT NULL,

    CONSTRAINT "ShariStudent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShariTeacher_fullName_key" ON "ShariTeacher"("fullName");

-- CreateIndex
CREATE UNIQUE INDEX "ShariTeacher_token_key" ON "ShariTeacher"("token");

-- CreateIndex
CREATE INDEX "Shara_group_idx" ON "Shara"("group");

-- CreateIndex
CREATE INDEX "Shara_teacherId_idx" ON "Shara"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "ShariAward_sharaId_slot_key" ON "ShariAward"("sharaId", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "ShariStudent_group_fullName_key" ON "ShariStudent"("group", "fullName");

-- AddForeignKey
ALTER TABLE "Shara" ADD CONSTRAINT "Shara_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "ShariTeacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShariAward" ADD CONSTRAINT "ShariAward_sharaId_fkey" FOREIGN KEY ("sharaId") REFERENCES "Shara"("id") ON DELETE CASCADE ON UPDATE CASCADE;

