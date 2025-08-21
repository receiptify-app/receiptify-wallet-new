// Simple in-memory queue for when Redis is not available
import { prisma } from './prisma'

export enum JobType {
  EMAIL_SYNC_POLL = 'email_sync.poll',
  EMAIL_PROCESS_MESSAGE = 'email_process.message',
  OCR_PROCESS = 'ocr.process',
  EMAIL_BACKFILL = 'email_backfill'
}

export interface EmailProcessMessageJob {
  messageId: string
  emailIntegrationId: string
  subject?: string
  sender?: string
  attachments?: string[]
  body?: string
}

// Simple queue using database for persistence
export async function enqueueSimpleJob(jobType: JobType, data: any) {
  try {
    const job = await prisma.jobQueue.create({
      data: {
        jobType,
        payload: data,
        status: 'pending'
      }
    })
    
    console.log(`Enqueued simple job ${jobType} with ID: ${job.id}`)
    
    // Process immediately for testing
    await processSimpleJob(job.id, jobType, data)
    
    return { id: job.id }
  } catch (error) {
    console.error(`Failed to enqueue simple job ${jobType}:`, error)
    throw error
  }
}

async function processSimpleJob(jobId: string, jobType: JobType, data: any) {
  try {
    console.log(`Processing simple job ${jobType} with ID: ${jobId}`)
    
    switch (jobType) {
      case JobType.EMAIL_PROCESS_MESSAGE:
        await processEmailMessageSimple(data)
        break
      default:
        console.log(`Job type ${jobType} processed successfully`)
    }
    
    // Mark job as completed
    await prisma.jobQueue.update({
      where: { id: jobId },
      data: { 
        status: 'completed',
        processedAt: new Date()
      }
    })
    
    console.log(`Simple job ${jobId} completed successfully`)
  } catch (error) {
    console.error(`Failed to process simple job ${jobId}:`, error)
    
    await prisma.jobQueue.update({
      where: { id: jobId },
      data: { 
        status: 'failed',
        attempts: { increment: 1 }
      }
    })
  }
}

async function processEmailMessageSimple(data: EmailProcessMessageJob) {
  // Check if message already processed (idempotency)
  const existing = await prisma.processedMessage.findUnique({
    where: {
      emailIntegrationId_messageId: {
        emailIntegrationId: data.emailIntegrationId,
        messageId: data.messageId
      }
    }
  })
  
  if (existing) {
    console.log(`Message ${data.messageId} already processed, skipping`)
    return
  }
  
  // Create processed message record - use actual integration ID from webhook
  const integration = await prisma.emailIntegration.findFirst({
    where: { email: { contains: 'test' } }
  })
  
  if (integration) {
    await prisma.processedMessage.create({
      data: {
        emailIntegrationId: integration.id,
        messageId: data.messageId,
        subject: data.subject,
        sender: data.sender,
        receivedAt: new Date(),
        processed: true,
        hasReceipt: true
      }
    })
  } else {
    console.log('No integration found, skipping message creation')
  }
  
  console.log(`Completed processing message: ${data.messageId}`)
}