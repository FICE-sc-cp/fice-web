-- CreateEnum
CREATE TYPE "MerchOrderStatus" AS ENUM ('PENDING', 'IN_PROCESS', 'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MerchDeliveryMethod" AS ENUM ('NOVA_POSHTA', 'CAMPUS', 'DAYF', 'LATER_CAMPUS');

-- CreateTable
CREATE TABLE "MerchConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "welcomeText" TEXT NOT NULL DEFAULT 'Вітаємо у нашому магазині мерчу! 🖤',
    "currency" VARCHAR(10) NOT NULL DEFAULT 'UAH',
    "monoJarUrl" VARCHAR(255) NOT NULL DEFAULT 'https://send.monobank.ua/',
    "cardNumber" VARCHAR(20),
    "dayfEnabled" BOOLEAN NOT NULL DEFAULT false,
    "adminChatId" BIGINT,
    "adminChatTitle" VARCHAR(255),
    "ordersThreadId" INTEGER,
    "supportThreadId" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchCustomer" (
    "telegramId" BIGINT NOT NULL,
    "username" VARCHAR(255),
    "firstName" VARCHAR(255),
    "lastName" VARCHAR(255),
    "blockedBot" BOOLEAN NOT NULL DEFAULT false,
    "prompt" VARCHAR(20),
    "promptUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchCustomer_pkey" PRIMARY KEY ("telegramId")
);

-- CreateTable
CREATE TABLE "MerchLink" (
    "id" SERIAL NOT NULL,
    "linkToken" VARCHAR(32),
    "sessionHash" VARCHAR(64),
    "telegramId" BIGINT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchRecipient" (
    "id" SERIAL NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "fullName" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(50) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchCategory" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MerchCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchTag" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MerchTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchProduct" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "categoryId" INTEGER,
    "saveKey" VARCHAR(36),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchProductTag" (
    "productId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,

    CONSTRAINT "MerchProductTag_pkey" PRIMARY KEY ("productId","tagId")
);

-- CreateTable
CREATE TABLE "MerchVariant" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "size" VARCHAR(20) NOT NULL,
    "color" VARCHAR(30) NOT NULL DEFAULT '',
    "price" DECIMAL(10,2) NOT NULL,
    "stock" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MerchVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchPhoto" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "color" VARCHAR(30) NOT NULL DEFAULT '',
    "url" TEXT NOT NULL,
    "thumbUrl" TEXT NOT NULL,
    "sourceFileId" VARCHAR(255),

    CONSTRAINT "MerchPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchTemplate" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "categoryId" INTEGER,
    "description" TEXT NOT NULL DEFAULT '',
    "tagIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "groupIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "sizes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "colors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prices" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchGroup" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchGroupMember" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "telegramId" BIGINT,
    "username" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchProductGroup" (
    "productId" INTEGER NOT NULL,
    "groupId" INTEGER NOT NULL,

    CONSTRAINT "MerchProductGroup_pkey" PRIMARY KEY ("productId","groupId")
);

-- CreateTable
CREATE TABLE "MerchPickupSlot" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "startTime" VARCHAR(5) NOT NULL,
    "endTime" VARCHAR(5) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchPickupSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchOrder" (
    "id" SERIAL NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "status" "MerchOrderStatus" NOT NULL DEFAULT 'PENDING',
    "deliveryMethod" "MerchDeliveryMethod",
    "address" TEXT NOT NULL,
    "phone" VARCHAR(50) NOT NULL,
    "recipientName" VARCHAR(255),
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'UAH',
    "receiptUrl" TEXT,
    "receiptFileId" VARCHAR(255),
    "clientKey" VARCHAR(64),
    "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "adminMessageId" INTEGER,
    "processedByAdmin" VARCHAR(255),
    "statusBy" VARCHAR(255),
    "pickupSlotId" INTEGER,
    "needsIndividualPickup" BOOLEAN NOT NULL DEFAULT false,
    "cardDirty" BOOLEAN NOT NULL DEFAULT false,
    "notifyDirty" BOOLEAN NOT NULL DEFAULT false,
    "pickupDirty" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchOrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER,
    "variantId" INTEGER,
    "title" VARCHAR(255) NOT NULL,
    "size" VARCHAR(20) NOT NULL,
    "color" VARCHAR(30) NOT NULL DEFAULT '',
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "stockTaken" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MerchOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MerchLink_linkToken_key" ON "MerchLink"("linkToken");

-- CreateIndex
CREATE UNIQUE INDEX "MerchLink_sessionHash_key" ON "MerchLink"("sessionHash");

-- CreateIndex
CREATE INDEX "MerchLink_telegramId_idx" ON "MerchLink"("telegramId");

-- CreateIndex
CREATE INDEX "MerchLink_expiresAt_idx" ON "MerchLink"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "MerchRecipient_telegramId_fullName_phone_key" ON "MerchRecipient"("telegramId", "fullName", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "MerchCategory_name_key" ON "MerchCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MerchTag_name_key" ON "MerchTag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MerchProduct_saveKey_key" ON "MerchProduct"("saveKey");

-- CreateIndex
CREATE INDEX "MerchProduct_isActive_order_idx" ON "MerchProduct"("isActive", "order");

-- CreateIndex
CREATE INDEX "MerchProduct_categoryId_idx" ON "MerchProduct"("categoryId");

-- CreateIndex
CREATE INDEX "MerchProductTag_tagId_idx" ON "MerchProductTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "MerchVariant_productId_size_color_key" ON "MerchVariant"("productId", "size", "color");

-- CreateIndex
CREATE UNIQUE INDEX "MerchPhoto_productId_color_key" ON "MerchPhoto"("productId", "color");

-- CreateIndex
CREATE UNIQUE INDEX "MerchTemplate_name_key" ON "MerchTemplate"("name");

-- CreateIndex
CREATE INDEX "MerchTemplate_categoryId_idx" ON "MerchTemplate"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "MerchGroup_name_key" ON "MerchGroup"("name");

-- CreateIndex
CREATE INDEX "MerchGroupMember_telegramId_idx" ON "MerchGroupMember"("telegramId");

-- CreateIndex
CREATE INDEX "MerchGroupMember_username_idx" ON "MerchGroupMember"("username");

-- CreateIndex
CREATE UNIQUE INDEX "MerchGroupMember_groupId_telegramId_key" ON "MerchGroupMember"("groupId", "telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "MerchGroupMember_groupId_username_key" ON "MerchGroupMember"("groupId", "username");

-- CreateIndex
CREATE INDEX "MerchProductGroup_groupId_idx" ON "MerchProductGroup"("groupId");

-- CreateIndex
CREATE INDEX "MerchPickupSlot_date_idx" ON "MerchPickupSlot"("date");

-- CreateIndex
CREATE INDEX "MerchOrder_telegramId_createdAt_idx" ON "MerchOrder"("telegramId", "createdAt");

-- CreateIndex
CREATE INDEX "MerchOrder_status_idx" ON "MerchOrder"("status");

-- CreateIndex
CREATE INDEX "MerchOrder_pickupSlotId_idx" ON "MerchOrder"("pickupSlotId");

-- CreateIndex
CREATE UNIQUE INDEX "MerchOrder_telegramId_clientKey_key" ON "MerchOrder"("telegramId", "clientKey");

-- CreateIndex
CREATE INDEX "MerchOrderItem_orderId_idx" ON "MerchOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "MerchOrderItem_productId_idx" ON "MerchOrderItem"("productId");

-- CreateIndex
CREATE INDEX "MerchOrderItem_variantId_idx" ON "MerchOrderItem"("variantId");

-- AddForeignKey
ALTER TABLE "MerchLink" ADD CONSTRAINT "MerchLink_telegramId_fkey" FOREIGN KEY ("telegramId") REFERENCES "MerchCustomer"("telegramId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchRecipient" ADD CONSTRAINT "MerchRecipient_telegramId_fkey" FOREIGN KEY ("telegramId") REFERENCES "MerchCustomer"("telegramId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchProduct" ADD CONSTRAINT "MerchProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MerchCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchProductTag" ADD CONSTRAINT "MerchProductTag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MerchProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchProductTag" ADD CONSTRAINT "MerchProductTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "MerchTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchVariant" ADD CONSTRAINT "MerchVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MerchProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchPhoto" ADD CONSTRAINT "MerchPhoto_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MerchProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchTemplate" ADD CONSTRAINT "MerchTemplate_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MerchCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchGroupMember" ADD CONSTRAINT "MerchGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "MerchGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchProductGroup" ADD CONSTRAINT "MerchProductGroup_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MerchProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchProductGroup" ADD CONSTRAINT "MerchProductGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "MerchGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchOrder" ADD CONSTRAINT "MerchOrder_telegramId_fkey" FOREIGN KEY ("telegramId") REFERENCES "MerchCustomer"("telegramId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchOrder" ADD CONSTRAINT "MerchOrder_pickupSlotId_fkey" FOREIGN KEY ("pickupSlotId") REFERENCES "MerchPickupSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchOrderItem" ADD CONSTRAINT "MerchOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MerchOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchOrderItem" ADD CONSTRAINT "MerchOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MerchProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchOrderItem" ADD CONSTRAINT "MerchOrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "MerchVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Things Prisma cannot express. The last line of defence if code is wrong.
ALTER TABLE "MerchConfig" ADD CONSTRAINT "MerchConfig_single_row" CHECK ("id" = 1);
ALTER TABLE "MerchVariant" ADD CONSTRAINT "MerchVariant_stock_not_negative" CHECK ("stock" IS NULL OR "stock" >= 0);
ALTER TABLE "MerchVariant" ADD CONSTRAINT "MerchVariant_price_not_negative" CHECK ("price" >= 0);
ALTER TABLE "MerchOrderItem" ADD CONSTRAINT "MerchOrderItem_stock_taken" CHECK ("quantity" > 0 AND "stockTaken" BETWEEN 0 AND "quantity");
ALTER TABLE "MerchGroupMember" ADD CONSTRAINT "MerchGroupMember_one_identity" CHECK (num_nonnulls("telegramId", "username") = 1);

-- The config row always exists, so no code path has to create it.
INSERT INTO "MerchConfig" ("id") VALUES (1);
