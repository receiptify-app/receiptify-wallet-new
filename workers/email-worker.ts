import { Worker } from 'bullmq'
import Redis from 'ioredis'
import { 
  JobType, 
  processEmailSyncPoll, 
  processEmailMessage, 
  processOcr, 
  processEmailBackfill 
} from '../lib/queue'

// Redis connection for worker
const redis = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: 1,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  lazyConnect: true,
  connectTimeout: 1000,
  commandTimeout: 1000
})

// Email worker
export const emailWorker = new Worker('email', async (job) => {
  console.log(`Processing job: ${job.name} with ID: ${job.id}`)
  
  try {
    switch (job.name) {
      case JobType.EMAIL_SYNC_POLL:
        await processEmailSyncPoll(job)
        break
      
      case JobType.EMAIL_PROCESS_MESSAGE:
        await processEmailMessage(job)
        break
      
      case JobType.OCR_PROCESS:
        await processOcr(job)
        break
      
      case JobType.EMAIL_BACKFILL:
        await processEmailBackfill(job)
        break
      
      default:
        throw new Error(`Unknown job type: ${job.name}`)
    }
    
    console.log(`Successfully processed job: ${job.name} with ID: ${job.id}`)
  } catch (error) {
    console.error(`Failed to process job: ${job.name} with ID: ${job.id}`, error)
    throw error
  }
}, { 
  connection: redis,
  concurrency: 5
})

emailWorker.on('completed', (job) => {
  console.log(`Job ${job.id} completed successfully`)
})

emailWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err)
})

emailWorker.on('error', (err) => {
  console.error('Worker error:', err)
})

console.log('Email worker started and listening for jobs...')