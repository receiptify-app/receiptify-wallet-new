// Simple in-memory queue for when Redis is not available
import { storage } from '../server/storage';

export enum JobType {
  EMAIL_SYNC_POLL = 'email_sync.poll',
  EMAIL_PROCESS_MESSAGE = 'email_process.message',
  OCR_PROCESS = 'ocr.process',
  EMAIL_BACKFILL = 'email_backfill'
}

interface Job {
  id: string;
  type: string;
  data: any;
  createdAt: Date;
  attempts: number;
}

class SimpleQueue {
  public queue: Job[] = [];
  public processing = new Set<string>();

  async enqueue(type: string, data: any): Promise<{ id: string }> {
    const job: Job = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      createdAt: new Date(),
      attempts: 0
    };

    this.queue.push(job);
    console.log(`Enqueued job ${type} with ID: ${job.id}`);

    // Process immediately for demo
    setImmediate(() => this.processJob(job));

    return { id: job.id };
  }

  private async processJob(job: Job) {
    if (this.processing.has(job.id)) {
      return;
    }

    this.processing.add(job.id);
    
    try {
      console.log(`Processing job ${job.type} with ID: ${job.id}`);
      
      switch (job.type) {
        case 'email_process.message':
          await this.processEmailMessage(job.data);
          break;
        case 'email_backfill':
          await this.processEmailBackfill(job.data);
          break;
        case 'email_process.test':
          await this.processTestIntegration(job.data);
          break;
        default:
          console.log(`Unknown job type: ${job.type}`);
      }
      
      // Remove from queue
      this.queue = this.queue.filter(q => q.id !== job.id);
      console.log(`Job ${job.id} completed successfully`);
    } catch (error) {
      console.error(`Job ${job.id} failed:`, error);
      job.attempts++;
      
      if (job.attempts < 3) {
        // Retry later
        setTimeout(() => this.processJob(job), 5000);
      } else {
        // Remove failed job
        this.queue = this.queue.filter(q => q.id !== job.id);
        console.error(`Job ${job.id} failed after 3 attempts`);
      }
    } finally {
      this.processing.delete(job.id);
    }
  }

  private async processEmailMessage(data: any) {
    const { messageId, integrationId, emailContent, source } = data;
    
    console.log(`Processing email message ${messageId} from ${source}`);
    
    // Mark message as processed
    await storage.createProcessedMessage({
      emailIntegrationId: integrationId,
      messageId,
      subject: emailContent.subject,
      sender: emailContent.from,
      receivedAt: new Date(),
      processed: true,
      hasReceipt: this.detectReceiptContent(emailContent),
    });

    // If it looks like a receipt, create a pending receipt
    if (this.detectReceiptContent(emailContent)) {
      const integration = await storage.getEmailIntegration(integrationId);
      if (integration) {
        await storage.createPendingReceipt({
          userId: integration.userId,
          sourceType: source === 'forwarding' ? 'forwarding' : 'email',
          subject: emailContent.subject,
          sender: emailContent.from,
          rawContent: JSON.stringify(emailContent),
          extractedAmount: this.extractAmount(emailContent),
          merchantName: this.extractMerchant(emailContent),
          processed: false,
        });
        
        console.log(`Created pending receipt for ${emailContent.subject}`);
      }
    }
  }

  private async processEmailBackfill(data: any) {
    const { integrationId, days } = data;
    
    console.log(`Processing backfill for integration ${integrationId}, ${days} days`);
    
    const integration = await storage.getEmailIntegration(integrationId);
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }

    // Update last sync time
    await storage.updateEmailIntegration(integrationId, {
      lastSyncAt: new Date(),
      syncCursor: `backfill_${Date.now()}`
    });

    console.log(`Backfill completed for ${integration.provider} (${integration.email})`);
  }

  private async processTestIntegration(data: any) {
    const { integrationId } = data;
    
    console.log(`Testing integration ${integrationId}`);
    
    // Create a test message
    await storage.createProcessedMessage({
      emailIntegrationId: integrationId,
      messageId: `test_${Date.now()}`,
      subject: "Test Integration",
      sender: "test@example.com", 
      receivedAt: new Date(),
      processed: true,
      hasReceipt: false,
    });
  }

  private detectReceiptContent(emailContent: any): boolean {
    const { subject, text, html } = emailContent;
    const content = `${subject} ${text} ${html}`.toLowerCase();
    
    const receiptKeywords = [
      'receipt', 'purchase', 'order', 'invoice', 'payment',
      'transaction', 'total', 'amount', 'paid', 'thank you for your order'
    ];
    
    return receiptKeywords.some(keyword => content.includes(keyword));
  }

  private extractAmount(emailContent: any): string | null {
    const { text, html } = emailContent;
    const content = `${text} ${html}`;
    
    // Look for amounts in various formats
    const amountRegex = /(?:£|GBP|total|amount|paid)[^\d]*(\d+\.?\d*)/i;
    const match = content.match(amountRegex);
    
    return match ? match[1] : null;
  }

  private extractMerchant(emailContent: any): string | null {
    const { from, subject } = emailContent;
    
    // Extract from email domain
    if (from) {
      const domain = from.split('@')[1];
      if (domain) {
        return domain.split('.')[0];
      }
    }
    
    // Extract from subject
    if (subject) {
      const merchantRegex = /from\s+([a-zA-Z0-9\s]+)/i;
      const match = subject.match(merchantRegex);
      if (match) {
        return match[1].trim();
      }
    }
    
    return null;
  }
}

export const simpleQueue = new SimpleQueue();

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
    const job = await storage.createJob({
      jobType,
      payload: data,
      status: 'pending'
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
    await storage.updateJob(jobId, { 
      status: 'completed'
    })
    
    console.log(`Simple job ${jobId} completed successfully`)
  } catch (error) {
    console.error(`Failed to process simple job ${jobId}:`, error)
    
    await storage.updateJob(jobId, { 
      status: 'failed'
    })
  }
}

async function processEmailMessageSimple(data: EmailProcessMessageJob) {
  // Check if message already processed (idempotency)
  const existing = await storage.getProcessedMessage(data.emailIntegrationId, data.messageId)
  
  if (existing) {
    console.log(`Message ${data.messageId} already processed, skipping`)
    return
  }
  
  // Get integration or use test integration
  let integration = await storage.getEmailIntegration(data.emailIntegrationId)
  
  if (!integration) {
    const integrations = await storage.getEmailIntegrations('test-user-id')
    integration = integrations[0] || null
    
    if (!integration) {
      console.log('No integration found, skipping message processing')
      return
    }
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
  const processedMessage = await storage.createProcessedMessage({
    emailIntegrationId: integration.id,
    messageId: data.messageId,
    subject: data.subject,
    sender: data.sender,
    receivedAt: new Date(),
    processed: true,
    hasReceipt: parsed.confidence > 0.3
  })
  
  // Create pending receipt for manual review (for testing workflow)
  if (parsed.confidence > 0.3) {
    const pendingReceipt = await storage.createPendingReceipt({
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
    const receipt = await storage.getReceipt(data.receiptId)
    
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