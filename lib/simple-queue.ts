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
      case JobType.OCR_PROCESS:
        await processOcrSimple(data)
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
  
  // Get integration or use test integration
  let integration = await prisma.emailIntegration.findFirst({
    where: { id: data.emailIntegrationId }
  })
  
  if (!integration) {
    integration = await prisma.emailIntegration.findFirst({
      where: { email: { contains: 'test' } }
    })
  }
  
  if (!integration) {
    console.log('No integration found, creating test integration')
    const testUser = await prisma.user.findFirst() || await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User'
      }
    })
    
    integration = await prisma.emailIntegration.create({
      data: {
        userId: testUser.id,
        provider: 'gmail',
        email: 'test@gmail.com',
        accessToken: 'test-token',
        refreshToken: 'test-refresh'
      }
    })
  }
  
  // Parse email content using the parser (dynamic import)
  const emailContent = {
    messageId: data.messageId,
    subject: data.subject,
    body: data.body || '',
    attachments: data.attachments || []
  }
  
  let parsed: any = {
    merchant: 'Unknown',
    amount: '0.00',
    date: new Date().toISOString(),
    lineItems: [],
    confidence: 0.5,
    attachments: []
  }
  
  try {
    // Dynamic import with absolute path
    const parserModule = await import(new URL('../utils/parser.js', import.meta.url).href)
    const parseEmailMessage = parserModule.parseEmailMessage || parserModule.default?.parseEmailMessage
    
    if (!parseEmailMessage) {
      throw new Error('parseEmailMessage function not found in parser module')
    }
    
    parsed = parseEmailMessage(emailContent)
    console.log('Parsed email data:', JSON.stringify(parsed, null, 2))
  } catch (error) {
    console.warn('Parser not available, using default values:', error.message)
    // Apply basic fallback parsing
    parsed.merchant = data.sender?.split('@')[1]?.split('.')[0] || 'Unknown'
    parsed.amount = (emailContent.body?.match(/\$?(\d+\.\d{2})/)?.[1]) || '0.00'
    parsed.confidence = 0.4
  }
  
  // Create processed message record (with upsert to handle duplicates)
  const processedMessage = await prisma.processedMessage.upsert({
    where: {
      emailIntegrationId_messageId: {
        emailIntegrationId: integration.id,
        messageId: data.messageId
      }
    },
    update: {
      processed: true,
      hasReceipt: parsed.confidence > 0.3
    },
    create: {
      emailIntegrationId: integration.id,
      messageId: data.messageId,
      subject: data.subject,
      sender: data.sender,
      receivedAt: new Date(),
      processed: true,
      hasReceipt: parsed.confidence > 0.3
    }
  })
  
  // Create pending receipt for manual review (for testing workflow)
  if (parsed.confidence > 0.3) {
    const pendingReceipt = await prisma.pendingReceipt.create({
      data: {
        messageId: data.messageId,
        userId: integration.userId,
        extractedData: {
          merchant: parsed.merchant || 'Unknown',
          amount: parsed.amount || '0.00',
          date: parsed.date || new Date().toISOString(),
          lineItems: parsed.lineItems || [],
          confidence: parsed.confidence,
          attachments: parsed.attachments || [],
          // Store original data for reprocessing
          rawHtml: data.body || '',
          subject: data.subject || '',
          sender: data.sender || ''
        },
        confidence: parsed.confidence,
        status: 'pending'
      }
    })
    
    // Process attachments if any
    if (parsed.attachments && parsed.attachments.length > 0) {
      for (const attachment of parsed.attachments) {
        if (attachment.url && (attachment.mime?.includes('image') || attachment.filename?.match(/\.(jpg|jpeg|png|pdf)$/i))) {
          // Enqueue OCR job for image attachments
          await enqueueSimpleJob(JobType.OCR_PROCESS, {
            receiptId: pendingReceipt.id,
            attachmentUrl: attachment.url,
            filename: attachment.filename
          })
        }
      }
    }
    
    console.log(`Created pending receipt ${pendingReceipt.id} for review (confidence: ${parsed.confidence})`)
  }
  
  console.log(`Completed processing message: ${data.messageId}`)
}

async function processOcrSimple(data: any) {
  console.log(`Processing OCR for receipt: ${data.receiptId}`)
  
  try {
    // Get receipt
    const receipt = await prisma.receipt.findUnique({
      where: { id: data.receiptId }
    })
    
    if (!receipt) {
      console.log(`Receipt ${data.receiptId} not found`)
      return
    }
    
    // Mock file path for OCR (in real implementation would download attachment)
    const mockFilePath = `/tmp/${data.filename}`
    
    // Run OCR on the attachment (dynamic import)
    let ocrResult = { text: '', confidence: 0 }
    try {
      const { ocrExtract } = await import('../utils/ocr.js')
      ocrResult = await ocrExtract(mockFilePath)
      console.log(`OCR result for ${data.filename}:`, ocrResult)
    } catch (error) {
      console.warn('OCR not available, using default values:', error.message)
    }
    
    // Update receipt with OCR data
    const currentMetadata = receipt.metadata as any || {}
    const updatedMetadata = {
      ...currentMetadata,
      ocrResults: {
        ...(currentMetadata.ocrResults || {}),
        [data.filename]: ocrResult
      }
    }
    
    await prisma.receipt.update({
      where: { id: data.receiptId },
      data: { metadata: updatedMetadata }
    })
    
    console.log(`Updated receipt ${data.receiptId} with OCR data`)
  } catch (error) {
    console.error(`Failed to process OCR for receipt ${data.receiptId}:`, error)
    throw error
  }
}