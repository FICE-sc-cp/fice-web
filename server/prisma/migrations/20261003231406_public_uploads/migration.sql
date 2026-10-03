-- CreateTable
CREATE TABLE "PublicUpload" (
    "id" UUID NOT NULL,
    "filename" VARCHAR(64) NOT NULL,
    "size" INTEGER NOT NULL,
    "ipHash" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unreferencedSince" TIMESTAMP(3),

    CONSTRAINT "PublicUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PublicUpload_filename_key" ON "PublicUpload"("filename");

-- CreateIndex
CREATE INDEX "PublicUpload_ipHash_createdAt_idx" ON "PublicUpload"("ipHash", "createdAt");

-- CreateIndex
CREATE INDEX "PublicUpload_createdAt_idx" ON "PublicUpload"("createdAt");
