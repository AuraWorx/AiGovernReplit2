import { storage } from "../storage";
import { analyzeBias } from "../analyzers/bias-analyzer";
// Import other analyzers as needed
// import { detectPiiInDocuments } from "../document-processors/pii-detector";
// import { parseDocument } from "../document-processors/document-parser";
import { analysisQueue, AnalysisJobData } from "./queue";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import { log } from "../utils/logger";
import path from "path"; // For potential filename extraction

const awsRegion = process.env.AWS_REGION || "us-west-2";
const resultsBucket = process.env.S3_RESULTS_BUCKET_NAME; // Bucket to store results JSON

const s3Client = new S3Client({ region: awsRegion });

// --- Helper Functions ---

// Gets S3 object content as a string (UTF-8 assumed)
async function getS3ObjectContent(bucket: string, key: string): Promise<string> {
    log(`Fetching s3://${bucket}/${key}`, 's3-fetch');
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    try {
        const { Body } = await s3Client.send(command);
        if (!Body) {
            throw new Error(`S3 object body is empty or missing for key: ${key}`);
        }
        // Use built-in streamToString for ReadableStream | Blob | Readable
        return await Body.transformToString('utf-8');
    } catch (error: any) {
        log(`Error fetching S3 object s3://${bucket}/${key}: ${error.message}`, 's3-error');
        throw error; // Re-throw to fail the job
    }
}

// Saves results JSON to S3 if bucket is configured
async function saveResultsToS3(analysisId: number, tenantId: number, results: any): Promise<string | null> {
    if (!resultsBucket) {
        log(`Analysis ${analysisId}: Results bucket not configured, skipping S3 save.`, 'analysis-result');
        return null; // Indicate results were not saved to S3
    }

    const resultsKey = `tenant_${tenantId}/results/analysis_${analysisId}_${Date.now()}.json`;
    const resultsJson = JSON.stringify(results, null, 2);

    log(`Analysis ${analysisId}: Storing results in s3://${resultsBucket}/${resultsKey}`, 'analysis-result');
    try {
        const putCommand = new PutObjectCommand({
            Bucket: resultsBucket,
            Key: resultsKey,
            Body: resultsJson,
            ContentType: 'application/json'
        });
        await s3Client.send(putCommand);
        log(`Analysis ${analysisId}: Successfully stored results at ${resultsKey}`, 'analysis-result');
        return `s3://${resultsBucket}/${resultsKey}`; // Return the S3 path
    } catch (error: any) {
        log(`Analysis ${analysisId}: Error storing results to S3 (s3://${resultsBucket}/${resultsKey}): ${error.message}`, 's3-error');
        // Decide if this should fail the job or just log the error
        // For now, log and return null, indicating save failure
        return null;
    }
}


// --- Analysis Processor Logic ---

export function initAnalysisProcessor() {
  log("Initializing analysis job processor...", 'analysis-processor');

  // Define the processing function for the queue
  analysisQueue.process(async (job) => {
    const {
      analysisId, tenantId, source, datasetId, s3Bucket, s3Key,
      webhookDataId, analysisType, initiatedById
    } = job.data as AnalysisJobData;

    let analysisRecord; // Store fetched analysis record

    try {
      log(`Starting job ${job.id} for analysis ${analysisId} (Type: ${analysisType})`, 'analysis-job');

      // 1. Fetch and Verify Analysis Record
      analysisRecord = await storage.getAnalysis(analysisId, tenantId);
      if (!analysisRecord) {
        throw new Error(`Analysis record ${analysisId} not found for tenant ${tenantId}.`);
      }
      // Prevent reprocessing if already completed or failed (unless explicitly designed for retries)
      if (['completed', 'failed'].includes(analysisRecord.status) && job.attemptsMade === 0) {
         log(`Analysis ${analysisId} already has status '${analysisRecord.status}'. Skipping initial processing.`, 'analysis-job');
         return { status: 'skipped', reason: `Already ${analysisRecord.status}` };
      }
      // Update status to 'processing'
      await storage.updateAnalysisStatus(analysisId, "processing");
      log(`Analysis ${analysisId} status updated to 'processing'.`, 'analysis-job');


      // 2. Get Input Data
      let inputData: any;
      let fileType = 'json'; // Default, will be updated for datasets
      let sourceDescription = ''; // For logging

      if (source === "upload" && datasetId && s3Bucket && s3Key) {
        sourceDescription = `dataset ${datasetId} (s3://${s3Bucket}/${s3Key})`;
        log(`Fetching data for ${sourceDescription}`, 'analysis-job');

        const dataset = await storage.getDataset(datasetId, tenantId);
        if (!dataset) throw new Error(`Dataset ${datasetId} not found for analysis ${analysisId}`);

        // Fetch content as string - suitable for bias analyzer
        inputData = await getS3ObjectContent(s3Bucket, s3Key);

        // Determine fileType based on dataset metadata
        if (dataset.fileType === "text/csv") {
          fileType = 'csv';
        } else if (dataset.fileType === "application/json") {
          fileType = 'json';
        } else {
          // For other types like PDF, DOCX, TXT - PII analyzer might need different handling
          fileType = dataset.fileType; // Pass the mime type
          log(`Dataset ${datasetId} has fileType ${fileType}. Analyzer needs to handle this.`, 'analysis-job');
          // Note: analyzeBias currently only handles CSV/JSON strings. PII would need adjustment.
        }

      } else if (source === "webhook" && webhookDataId) {
        sourceDescription = `webhook data ${webhookDataId}`;
        log(`Fetching data for ${sourceDescription}`, 'analysis-job');

        const webhookDataRecord = await storage.getWebhookDataById(webhookDataId, tenantId);
        if (!webhookDataRecord) throw new Error(`Webhook data ${webhookDataId} not found`);
        inputData = webhookDataRecord.payload; // Assumed to be JSON object
        fileType = 'json'; // Or determine from webhook config if possible

      } else {
        throw new Error("Invalid job data: Missing required fields for S3 or Webhook.");
      }

      // 3. Perform Analysis based on type
      let results: any;
      log(`Running ${analysisType} analysis for ID ${analysisId} on ${sourceDescription}`, 'analysis-job');

      if (analysisType === "bias_analysis") {
        // analyzeBias expects string (CSV/JSON) or object array
        results = await analyzeBias(inputData, fileType);
      } else if (analysisType === "pii_detection") {
        // TODO: Refactor PII detection
        // Current pii-detector expects ExtractedDocument[] from local files.
        // Needs modification to accept `inputData` (string/buffer/object) and `fileType`.
        // It might need to use document-parser internally if input is PDF/DOCX.
        log(`PII detection needs refactoring for S3/Webhook input. Analysis ID: ${analysisId}`, 'analysis-job');
        results = {
            status: "skipped",
            message: "PII detection requires refactoring for non-local file input.",
            source: sourceDescription,
            fileType: fileType
        };
        // throw new Error("PII detection not yet implemented for this input type.");
      } else {
        throw new Error(`Unsupported analysis type: ${analysisType}`);
      }
      log(`Analysis ${analysisType} completed for ID ${analysisId}`, 'analysis-job');


      // 4. Store Results (e.g., in S3)
      const resultsS3Path = await saveResultsToS3(analysisId, tenantId, results);


      // 5. Update Analysis Record in DB
      await storage.updateAnalysisStatus(
        analysisId,
        "completed",
        resultsS3Path // Store S3 path (or null if save failed/disabled)
      );

      // 6. Log Completion Activity
      await storage.logActivity({
        action: "analysis_completed",
        description: `Completed ${analysisType} for ${sourceDescription}. Results: ${resultsS3Path || 'Not stored in S3'}`,
        entityType: "analysis",
        entityId: analysisId,
        tenantId,
        userId: initiatedById
      });

      log(`Job ${job.id} (Analysis ID: ${analysisId}) completed successfully. Results at: ${resultsS3Path || 'N/A'}`, 'analysis-job');
      return { analysisId: analysisId, status: 'completed', resultsLocation: resultsS3Path }; // Return summary

    } catch (error: any) {
      log(`Error in job ${job.id} (Analysis ID: ${analysisId}): ${error.message}`, 'analysis-job-error');
      console.error(`Analysis Job ${job.id} Error Stack:`, error.stack);

      // Update analysis status to failed if possible
      if (analysisId) {
          try {
              await storage.updateAnalysisStatus(analysisId, "failed", `Error: ${error.message}`); // Optionally store error message
              // Log failure activity
              await storage.logActivity({
                action: "analysis_failed",
                description: `Failed ${analysisType || 'analysis'} for ${analysisRecord?.source || source} ID ${datasetId || webhookDataId || 'unknown'}: ${error.message}`,
                entityType: "analysis",
                entityId: analysisId,
                tenantId: tenantId || analysisRecord?.tenantId || 0,
                userId: initiatedById || analysisRecord?.initiatedById || 0
              });
          } catch (dbError: any) {
              log(`Failed to update analysis ${analysisId} status to failed after job error: ${dbError.message}`, 'analysis-db-error');
          }
      }
      // IMPORTANT: Rethrow the error to mark the Bull job as failed for retry logic
      throw error;
    }
  }); // End of analysisQueue.process

  log("Analysis job processor is ready and waiting for jobs.", 'analysis-processor');
}

// --- Queueing Function (Moved here for collocation with processor) ---
export async function queueAnalysisJob(options: {
    source: "upload" | "webhook";
    datasetId?: number;
    webhookDataId?: number;
    analysisType: string;
    tenantId: number;
    initiatedById: number;
}): Promise<number> { // Returns the analysis ID

  log(`Received request to queue analysis: ${JSON.stringify(options)}`, 'analysis-queue');

  let jobPayloadBase: Omit<AnalysisJobData, 'analysisId' | 's3Bucket' | 's3Key'> = {
      source: options.source,
      datasetId: options.datasetId,
      webhookDataId: options.webhookDataId,
      analysisType: options.analysisType,
      tenantId: options.tenantId,
      initiatedById: options.initiatedById,
  };
  let s3Info: { s3Bucket?: string, s3Key?: string } = {};

  // Create the analysis record in the database FIRST
  const analysis = await storage.createAnalysis({
      name: `${options.analysisType} - ${options.source} ${options.datasetId || options.webhookDataId || ''} - ${new Date().toISOString().split('T')[0]}`,
      analysisType: options.analysisType,
      // status: 'queued', // Status is set to 'pending' by default in createAnalysis
      datasetId: options.datasetId || null,
      webhookDataId: options.webhookDataId || null,
      tenantId: options.tenantId,
      initiatedById: options.initiatedById
  });
  log(`Created analysis record ${analysis.id} with status '${analysis.status}'`, 'analysis-queue');

  try {
      // If source is upload, fetch S3 details from the dataset record
      if (options.source === 'upload' && options.datasetId) {
          const dataset = await storage.getDataset(options.datasetId, options.tenantId);
          if (!dataset || !dataset.s3Bucket || !dataset.s3Key) {
              throw new Error(`Cannot queue analysis: Dataset ${options.datasetId} not found or missing S3 info.`);
          }
          s3Info = { s3Bucket: dataset.s3Bucket, s3Key: dataset.s3Key };
          log(`Found S3 info for dataset ${options.datasetId}: s3://${s3Info.s3Bucket}/${s3Info.s3Key}`, 'analysis-queue');
      } else if (options.source === 'webhook' && !options.webhookDataId) {
           throw new Error('Webhook source requires webhookDataId.');
      }

      // Prepare the final job data payload
      const jobData: AnalysisJobData = {
          ...jobPayloadBase,
          ...s3Info,
          analysisId: analysis.id // Include the created analysis ID
      };

      // Add the job to the Bull queue
      const job = await analysisQueue.add(jobData); // Bull handles serialization

      // Update analysis status to 'queued' now that it's in Bull
      await storage.updateAnalysisStatus(analysis.id, "queued");

      log(`Job ${job.id} added to queue for analysis ID: ${analysis.id}`, 'analysis-queue');

      // Log activity: Analysis Queued
      await storage.logActivity({
          action: "analysis_queued",
          description: `Queued ${options.analysisType} on ${options.source} ID ${options.datasetId || options.webhookDataId}`,
          entityType: "analysis",
          entityId: analysis.id,
          tenantId: options.tenantId,
          userId: options.initiatedById
      });

      return analysis.id; // Return the ID of the created analysis record

  } catch (error: any) {
      log(`Error queueing analysis job for analysis ${analysis.id}: ${error.message}`, 'analysis-queue-error');
      // Attempt to mark the analysis as failed if queueing fails
      try {
          await storage.updateAnalysisStatus(analysis.id, "failed", `Failed to queue: ${error.message}`);
      } catch (dbError: any) {
          log(`Failed to update analysis ${analysis.id} status to failed after queueing error: ${dbError.message}`, 'analysis-db-error');
      }
      throw error; // Re-throw the original error
  }
}

// Call initialization when this module is loaded (e.g., during server startup)
// Ensure this runs only once. A common pattern is to call it from server/index.ts
// initAnalysisProcessor();
