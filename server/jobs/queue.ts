import Queue from 'bull';
import * as dotenv from 'dotenv';
import { log } from '../utils/logger';

dotenv.config();

const redisUrl = process.env.REDIS_URL;
const isProduction = process.env.NODE_ENV === 'production';

if (!redisUrl) {
    log("FATAL: REDIS_URL environment variable is not set. Bull queue cannot be initialized.", "bull-init");
    throw new Error("REDIS_URL is required for Bull queue.");
}

log(`Initializing Bull queue with Redis URL: ${redisUrl.substring(0, redisUrl.indexOf(':'))}:***`, "bull-init");

// Configure Redis options, especially for TLS in production if needed
const redisOptions = {
    // Example: Enable TLS if your ElastiCache requires it
    // tls: isProduction ? {} : undefined,
    // Add other options like password if necessary
    // password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: 3, // Optional: Limit retries for Redis commands
    enableReadyCheck: true, // Ensure client is ready before processing
};

// Create the Bull queue instance
const analysisQueue = new Queue('analysis-jobs', redisUrl, {
    redis: redisOptions,
    defaultJobOptions: {
      attempts: 3, // Default attempts for jobs
      backoff: {    // Exponential backoff for retries
        type: 'exponential',
        delay: 5000 // Start with 5 seconds delay
      },
      removeOnComplete: 1000, // Keep last 1000 completed jobs
      removeOnFail: 5000,     // Keep last 5000 failed jobs
    }
});

log('Bull queue instance created.', 'bull-init');

// --- Job Data Interface ---
// (Includes S3 details needed by the processor)
export interface AnalysisJobData {
  analysisId: number;
  tenantId: number;
  source: "upload" | "webhook";
  datasetId?: number;
  s3Bucket?: string;   // S3 bucket where dataset file is stored
  s3Key?: string;      // S3 key for the dataset file
  webhookDataId?: number;
  analysisType: string;
  initiatedById: number;
}

// --- Queue Event Logging ---
analysisQueue.on('completed', (job, result) => {
  log(`Job ${job.id} (Type: ${job.data.analysisType}, AnalysisID: ${job.data.analysisId}) completed.`, 'bull-event');
});

analysisQueue.on('failed', (job, error) => {
  log(`Job ${job.id} (Type: ${job.data.analysisType}, AnalysisID: ${job.data.analysisId}) failed: ${error.message}`, 'bull-error');
  // Avoid logging potentially large job data here, log the error itself
  console.error(`Failed Job ${job.id} Error Details:`, error);
});

analysisQueue.on('error', (error) => {
   // This listener is for queue-level errors (e.g., connection issues)
   log(`Bull queue encountered an error: ${error.message}`, 'bull-error');
   console.error('Bull Queue Error:', error);
});

analysisQueue.on('stalled', (job) => {
    log(`Job ${job.id} (Type: ${job.data.analysisType}, AnalysisID: ${job.data.analysisId}) has stalled.`, 'bull-warning');
});

analysisQueue.on('waiting', (jobId) => {
    // This can be very verbose, enable only if needed for debugging
    // log(`Job ${jobId} is waiting in the queue.`, 'bull-debug');
});

analysisQueue.on('active', (job) => {
     log(`Job ${job.id} (Type: ${job.data.analysisType}, AnalysisID: ${job.data.analysisId}) has started.`, 'bull-event');
});

// Optional: Graceful shutdown handling
const shutdown = async () => {
  log('Shutting down Bull queue processor...', 'shutdown');
  await analysisQueue.close();
  log('Bull queue closed.', 'shutdown');
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { analysisQueue };
