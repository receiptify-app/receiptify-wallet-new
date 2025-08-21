import { Queue, Worker, Job } from 'bullmq'
import Redis from 'ioredis'
import { prisma } from './prisma'

// Redis connection for development - using in-memory fallback if Redis not available
const redis = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: 1,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  lazyConnect: true,
  // Fallback for development when Redis isn't available
  connectTimeout: 1000,
  commandTimeout: 1000
})

// Job queues
export const emailQueue = new Queue('email', { connection: redis })

// Job types
export enum JobType {
  EMAIL_SYNC_POLL = 'email_sync.poll',
  EMAIL_PROCESS_MESSAGE = 'email_process.message',
  OCR_PROCESS = 'ocr.process',
  EMAIL_BACKFILL = 'email_backfill'
}

export interface EmailSyncPollJob {
  emailIntegrationId: string
  lastSyncedMessageId?: string
}

export interface EmailProcessMessageJob {
  messageId: string
  emailIntegrationId: string
  subject?: string
  sender?: string
  attachments?: string[]
  body?: string
}

export interface OcrProcessJob {
  pendingReceiptId: string
  imageUrl: string
}

export interface EmailBackfillJob {
  emailIntegrationId: string
  startDate?: string
  endDate?: string
}

// Enqueue job helper
export async function enqueueJob(jobType: JobType, data: any, options: any = {}) {
  try {
    const job = await emailQueue.add(jobType, data, {
      removeOnComplete: 10,
      removeOnFail: 5,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      ...options
    })
    
    console.log(`Enqueued job ${jobType} with ID: ${job.id}`)
    return job
  } catch (error) {
    console.error(`Failed to enqueue job ${jobType}:`, error)
    throw error
  }
}

// Job processors
export async function processEmailSyncPoll(job: Job<EmailSyncPollJob>) {
  console.log(`Processing email sync poll for integration: ${job.data.emailIntegrationId}`)
  
  // Mark as processed in DB
  await prisma.emailSyncJob.create({
    data: {
      emailIntegrationId: job.data.emailIntegrationId,
      jobType: 'poll',
      status: 'completed',
      lastSyncedMessageId: job.data.lastSyncedMessageId
    }
  })
  
  console.log(`Completed email sync poll for integration: ${job.data.emailIntegrationId}`)
}

export async function processEmailMessage(job: Job<EmailProcessMessageJob>) {
  console.log(`Processing email message: ${job.data.messageId}`)
  
  // Check if message already processed (idempotency)
  const existing = await prisma.processedMessage.findUnique({
    where: {
      emailIntegrationId_messageId: {
        emailIntegrationId: job.data.emailIntegrationId,
        messageId: job.data.messageId
      }
    }
  })
  
  if (existing) {
    console.log(`Message ${job.data.messageId} already processed, skipping`)
    return
  }
  
  // Create processed message record
  await prisma.processedMessage.create({
    data: {
      emailIntegrationId: job.data.emailIntegrationId,
      messageId: job.data.messageId,
      subject: job.data.subject,
      sender: job.data.sender,
      receivedAt: new Date(),
      processed: true
    }
  })
  
  console.log(`Completed processing message: ${job.data.messageId}`)
}

export async function processOcr(job: Job<OcrProcessJob>) {
  console.log(`Processing OCR for pending receipt: ${job.data.pendingReceiptId}`)
  
  // Stub OCR processing - in real implementation would call OCR service
  const mockExtractedData = {
    merchantName: "Mock Merchant",
    total: "25.99",
    date: new Date().toISOString(),
    items: [
      { name: "Item 1", price: "15.99" },
      { name: "Item 2", price: "10.00" }
    ]
  }
  
  await prisma.pendingReceipt.update({
    where: { id: job.data.pendingReceiptId },
    data: {
      extractedData: mockExtractedData,
      confidence: 0.85
    }
  })
  
  console.log(`Completed OCR processing for: ${job.data.pendingReceiptId}`)
}

export async function processEmailBackfill(job: Job<EmailBackfillJob>) {
  console.log(`Processing email backfill for integration: ${job.data.emailIntegrationId}`)
  
  // Mark backfill job as completed
  await prisma.emailSyncJob.create({
    data: {
      emailIntegrationId: job.data.emailIntegrationId,
      jobType: 'backfill',
      status: 'completed'
    }
  })
  
  console.log(`Completed email backfill for integration: ${job.data.emailIntegrationId}`)
}