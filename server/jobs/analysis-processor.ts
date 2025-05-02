import { storage } from "../storage";
import { analyzeBias } from "../analyzers/bias-analyzer";
import { analysisQueue, AnalysisJobData } from "./queue";
import fs from "fs/promises";
import path from "path";
import os from "os";

// Initialize the processor
export function initAnalysisProcessor() {
  // Set up the analysis queue processor
  analysisQueue.process(async (job) => {
    const { analysisId, tenantId, source, datasetId, webhookDataId, analysisType, initiatedById } = job.data as AnalysisJobData;
    
    try {
      console.log(`Processing analysis job ${job.id} for analysis ID: ${analysisId}`);
      
      // Get the analysis record
      const analysis = await storage.getAnalysis(analysisId, tenantId);
      if (!analysis) {
        throw new Error(`Analysis record ${analysisId} not found`);
      }
      
      // Get source data
      let sourceData;
      let inputData;
      let fileType = 'json';

      if (source === "upload" && datasetId) {
        const dataset = await storage.getDataset(datasetId, tenantId);
        if (!dataset) {
          throw new Error("Dataset not found");
        }
        
        // Read file
        const filePath = dataset.filePath;
        sourceData = await fs.readFile(filePath, "utf-8");
        
        // Determine file type
        if (dataset.fileType === "text/csv") {
          fileType = 'csv';
        }
        
        // For CSV and JSON, pass the raw content to the analyzer
        // which will parse it correctly based on fileType
        inputData = sourceData;
      } else if (source === "webhook" && webhookDataId) {
        const webhookDataRecord = await storage.getWebhookDataById(webhookDataId, tenantId);
        if (!webhookDataRecord) {
          throw new Error("Webhook data not found");
        }
        
        inputData = webhookDataRecord.payload;
      } else {
        throw new Error("Invalid source or missing ID");
      }

      // Process data based on analysis type
      let results;
      
      if (analysisType === "bias_analysis") {
        results = await analyzeBias(inputData, fileType);
      } else if (analysisType === "pii_detection") {
        // Use the PII detection module (not implemented in this example)
        throw new Error("PII detection not yet implemented");
      } else {
        throw new Error(`Unknown analysis type: ${analysisType}`);
      }

      // Save results to a file
      const resultsDir = path.join(os.tmpdir(), "ai-govern", "results");
      await fs.mkdir(resultsDir, { recursive: true });
      
      const resultsFilePath = path.join(resultsDir, `analysis_${analysisId}.json`);
      await fs.writeFile(resultsFilePath, JSON.stringify(results, null, 2));

      // Update analysis status
      const updatedAnalysis = await storage.updateAnalysisStatus(
        analysisId,
        "completed",
        resultsFilePath
      );

      // Log activity
      await storage.logActivity({
        action: "analysis_completed",
        description: `Completed ${analysisType} on ${source === "upload" ? "uploaded file" : "webhook data"}`,
        entityType: "analysis",
        entityId: analysisId,
        tenantId,
        userId: initiatedById
      });

      console.log(`Analysis job ${job.id} completed successfully`);
      return updatedAnalysis;
    } catch (error) {
      console.error(`Error processing analysis job ${job.id}:`, error);
      
      // Update analysis status to failed
      await storage.updateAnalysisStatus(
        analysisId,
        "failed"
      );
      
      // Log activity
      await storage.logActivity({
        action: "analysis_failed",
        description: `Failed ${analysisType} on ${source === "upload" ? "uploaded file" : "webhook data"}: ${error.message}`,
        entityType: "analysis",
        entityId: analysisId,
        tenantId,
        userId: initiatedById
      });
      
      // Rethrow the error to mark the job as failed
      throw error;
    }
  });
  
  console.log("Analysis job processor initialized");
}

// Helper function to queue a new analysis job
export async function queueAnalysisJob(options: Omit<AnalysisJobData, "analysisId">): Promise<number> {
  // Create analysis record
  const analysis = await storage.createAnalysis({
    name: `${options.analysisType} - ${new Date().toISOString()}`,
    analysisType: options.analysisType,
    status: "queued",
    datasetId: options.datasetId || null,
    webhookDataId: options.webhookDataId || null,
    tenantId: options.tenantId,
    initiatedById: options.initiatedById
  });
  
  // Log activity
  await storage.logActivity({
    action: "analysis_queued",
    description: `Queued ${options.analysisType} on ${options.source === "upload" ? "uploaded file" : "webhook data"}`,
    entityType: "analysis",
    entityId: analysis.id,
    tenantId: options.tenantId,
    userId: options.initiatedById
  });
  
  // Add job to queue
  const job = await analysisQueue.add({
    ...options,
    analysisId: analysis.id
  }, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: true
  });
  
  console.log(`Analysis job ${job.id} added to queue for analysis ID: ${analysis.id}`);
  
  return analysis.id;
}