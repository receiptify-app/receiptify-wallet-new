-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."email_integrations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."email_sync_jobs" (
    "id" TEXT NOT NULL,
    "emailIntegrationId" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lastSyncedMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."processed_messages" (
    "id" TEXT NOT NULL,
    "emailIntegrationId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "subject" TEXT,
    "sender" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "hasReceipt" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pending_receipts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "extractedData" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."receipts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "processedMessageId" TEXT,
    "merchantName" TEXT NOT NULL,
    "total" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "receiptNumber" TEXT,
    "category" TEXT,
    "paymentMethod" TEXT,
    "location" TEXT,
    "items" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."forwarding_addresses" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "userId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forwarding_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."job_queue" (
    "id" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "email_integrations_userId_provider_email_key" ON "public"."email_integrations"("userId", "provider", "email");

-- CreateIndex
CREATE UNIQUE INDEX "processed_messages_emailIntegrationId_messageId_key" ON "public"."processed_messages"("emailIntegrationId", "messageId");

-- CreateIndex
CREATE UNIQUE INDEX "forwarding_addresses_address_key" ON "public"."forwarding_addresses"("address");

-- AddForeignKey
ALTER TABLE "public"."email_integrations" ADD CONSTRAINT "email_integrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."email_sync_jobs" ADD CONSTRAINT "email_sync_jobs_emailIntegrationId_fkey" FOREIGN KEY ("emailIntegrationId") REFERENCES "public"."email_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."processed_messages" ADD CONSTRAINT "processed_messages_emailIntegrationId_fkey" FOREIGN KEY ("emailIntegrationId") REFERENCES "public"."email_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pending_receipts" ADD CONSTRAINT "pending_receipts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."receipts" ADD CONSTRAINT "receipts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."receipts" ADD CONSTRAINT "receipts_processedMessageId_fkey" FOREIGN KEY ("processedMessageId") REFERENCES "public"."processed_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
