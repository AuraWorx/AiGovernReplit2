import Queue from 'bull';
import * as dotenv from 'dotenv';
import { EventEmitter } from 'events';

// Load environment variables
dotenv.config();

// Create a simplified in-memory queue for development
class InMemoryQueue extends EventEmitter {
  private jobs: Map<string, any> = new Map();
  private processors: Array<(job: any) => Promise<any>> = [];
  private jobCounter = 0;

  constructor(private name: string) {
    super();
    console.log(`Creating in-memory queue: ${name}`);
  }

  async add(data: any, options?: any): Promise<any> {
    const jobId = `${this.name}-${++this.jobCounter}`;
    const job = {
      id: jobId,
      data,
      opts: options || {},
      attemptsMade: 0
    };
    
    this.jobs.set(jobId, job);
    console.log(`Added job ${jobId} to queue ${this.name}`);
    
    // Process the job on next tick to simulate async behavior
    process.nextTick(() => this.processJob(job));
    
    return job;
  }

  process(processor: (job: any) => Promise<any>): void {
    this.processors.push(processor);
    console.log(`Added processor to queue ${this.name}`);
  }

  private async processJob(job: any): Promise<void> {
    if (this.processors.length === 0) {
      console.warn('No processor registered for queue');
      return;
    }
    
    try {
      console.log(`Processing job ${job.id}`);
      const processor = this.processors[0]; // Use the first processor
      const result = await processor(job);
      console.log(`Job ${job.id} completed successfully`);
      this.emit('completed', job, result);
    } catch (error) {
      console.error(`Error processing job ${job.id}:`, error);
      this.emit('failed', job, error);
      
      // Handle retries if configured
      if (job.opts.attempts && job.attemptsMade < job.opts.attempts) {
        job.attemptsMade++;
        
        // Simple exponential backoff
        const delay = job.opts.backoff?.delay || 1000;
        const retryDelay = job.opts.backoff?.type === 'exponential'
          ? delay * Math.pow(2, job.attemptsMade - 1)
          : delay;
        
        console.log(`Retrying job ${job.id} in ${retryDelay}ms (attempt ${job.attemptsMade} of ${job.opts.attempts})`);
        setTimeout(() => this.processJob(job), retryDelay);
      }
    }
  }

  clean(ttl: number, status: string): void {
    // In-memory implementation doesn't need cleaning
    console.log(`Would clean ${status} jobs older than ${ttl}ms`);
  }

  // Other methods as needed
  on(event: string, callback: (...args: any[]) => void): this {
    super.on(event, callback);
    return this;
  }
}

// Use Bull with Redis in production, but fallback to in-memory queue for development
let analysisQueue: Queue.Queue | InMemoryQueue;

// Try to create the real Bull queue with Redis
try {
  if (process.env.REDIS_URL) {
    analysisQueue = new Queue('analysis-jobs', process.env.REDIS_URL);
    console.log('Using Redis-backed Bull queue');
    
    // Clean old jobs periodically (only for real Bull queue)
    analysisQueue.clean(15 * 24 * 60 * 60 * 1000, 'completed'); // Remove completed jobs after 15 days
    analysisQueue.clean(15 * 24 * 60 * 60 * 1000, 'failed'); // Remove failed jobs after 15 days
  } else {
    throw new Error('No REDIS_URL defined, using in-memory queue');
  }
} catch (error: any) {
  console.log('Failed to connect to Redis, using in-memory queue:', error.message || 'Unknown error');
  analysisQueue = new InMemoryQueue('analysis-jobs');
}

// Define job types
export interface AnalysisJobData {
  analysisId: number;
  tenantId: number;
  source: "upload" | "webhook";
  datasetId?: number;
  webhookDataId?: number;
  analysisType: string;
  initiatedById: number;
}

// Log events for debugging
analysisQueue.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed with result:`, typeof result === 'object' ? 'Analysis result object' : result);
});

analysisQueue.on('failed', (job, error) => {
  console.error(`Job ${job.id} failed with error:`, error);
});

export { analysisQueue };