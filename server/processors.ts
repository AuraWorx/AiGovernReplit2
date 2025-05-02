import { storage } from "./storage";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";

interface ProcessOptions {
  source: "upload" | "webhook";
  datasetId?: number;
  webhookDataId?: number;
  analysisType?: string;
  tenantId: number;
  initiatedById: number;
}

// Process uploaded data or webhook data
export async function processData(options: ProcessOptions): Promise<any> {
  const { source, datasetId, webhookDataId, analysisType = "bias_analysis", tenantId, initiatedById } = options;
  
  try {
    // Create analysis record
    const analysis = await storage.createAnalysis({
      name: `${analysisType} - ${new Date().toISOString()}`,
      analysisType,
      status: "processing",
      datasetId: datasetId || null,
      webhookDataId: webhookDataId || null,
      tenantId,
      initiatedById
    });

    // Log activity
    await storage.logActivity({
      action: "analysis_started",
      description: `Started ${analysisType} on ${source === "upload" ? "uploaded file" : "webhook data"}`,
      entityType: "analysis",
      entityId: analysis.id,
      tenantId,
      userId: initiatedById
    });

    // In a real production environment, we'd queue this task in a background worker
    // For this implementation, we'll just do it directly (not recommended for production)

    // Get source data
    let sourceData;
    let inputData;

    if (source === "upload" && datasetId) {
      const dataset = await storage.getDataset(datasetId, tenantId);
      if (!dataset) {
        throw new Error("Dataset not found");
      }
      
      // Read file
      const filePath = dataset.filePath;
      sourceData = await fs.readFile(filePath, "utf-8");
      
      // Parse data based on file type
      if (dataset.fileType === "application/json") {
        inputData = JSON.parse(sourceData);
      } else if (dataset.fileType === "text/csv") {
        // Simple CSV parsing - in production, use a proper CSV parser
        inputData = sourceData
          .split("\n")
          .map(line => line.split(","))
          .filter(row => row.length > 1);
      } else {
        throw new Error("Unsupported file type");
      }
    } else if (source === "webhook" && webhookDataId) {
      const data = await storage.webhookData.findFirst({
        where: { id: webhookDataId }
      });
      if (!data) {
        throw new Error("Webhook data not found");
      }
      
      inputData = data.payload;
    } else {
      throw new Error("Invalid source or missing ID");
    }

    // Process data based on analysis type
    let results;
    
    if (analysisType === "bias_analysis") {
      results = await runBiasAnalysis(inputData);
    } else if (analysisType === "pii_detection") {
      results = await runPiiDetection(inputData);
    } else {
      // Default to simple data validation
      results = validateData(inputData);
    }

    // Save results to a file
    const resultsDir = path.join(os.tmpdir(), "ai-govern", "results");
    await fs.mkdir(resultsDir, { recursive: true });
    
    const resultsFilePath = path.join(resultsDir, `analysis_${analysis.id}.json`);
    await fs.writeFile(resultsFilePath, JSON.stringify(results, null, 2));

    // Update analysis status
    const updatedAnalysis = await storage.updateAnalysisStatus(
      analysis.id,
      "completed",
      resultsFilePath
    );

    // Log activity
    await storage.logActivity({
      action: "analysis_completed",
      description: `Completed ${analysisType} on ${source === "upload" ? "uploaded file" : "webhook data"}`,
      entityType: "analysis",
      entityId: analysis.id,
      tenantId,
      userId: initiatedById
    });

    return updatedAnalysis;
  } catch (error) {
    console.error(`Error processing data: ${error}`);
    
    // If we have an analysis ID, update its status
    if (options.datasetId || options.webhookDataId) {
      // Create failed analysis if we haven't created one yet
      const analysis = await storage.createAnalysis({
        name: `${analysisType} - ${new Date().toISOString()}`,
        analysisType,
        status: "failed",
        datasetId: datasetId || null,
        webhookDataId: webhookDataId || null,
        tenantId,
        initiatedById
      });

      // Log error activity
      await storage.logActivity({
        action: "analysis_failed",
        description: `Failed ${analysisType} on ${source === "upload" ? "uploaded file" : "webhook data"}: ${error.message}`,
        entityType: "analysis",
        entityId: analysis.id,
        tenantId,
        userId: initiatedById
      });

      return analysis;
    }
    
    throw error;
  }
}

// Simple data validation
function validateData(data: any): any {
  // Basic validation
  const results = {
    valid: true,
    records: Array.isArray(data) ? data.length : 1,
    issues: [] as string[],
    summary: {}
  };

  if (Array.isArray(data)) {
    // Check for empty array
    if (data.length === 0) {
      results.valid = false;
      results.issues.push("Empty dataset");
    }

    // Check for consistency (all objects have the same keys)
    if (data.length > 1) {
      const firstItemKeys = Object.keys(data[0] || {}).sort().join(",");
      
      for (let i = 1; i < data.length; i++) {
        const currentKeys = Object.keys(data[i] || {}).sort().join(",");
        if (currentKeys !== firstItemKeys) {
          results.valid = false;
          results.issues.push(`Inconsistent data structure at index ${i}`);
          break;
        }
      }
    }

    // Generate summary of data types
    if (data.length > 0 && typeof data[0] === "object") {
      const fields = Object.keys(data[0] || {});
      
      results.summary = fields.reduce((acc, field) => {
        acc[field] = {
          type: typeof data[0][field],
          sampleValues: data.slice(0, 3).map(item => item[field])
        };
        return acc;
      }, {});
    }
  } else if (typeof data === "object" && data !== null) {
    // For single JSON objects
    results.summary = Object.keys(data).reduce((acc, key) => {
      acc[key] = {
        type: typeof data[key],
        value: data[key]
      };
      return acc;
    }, {});
  } else {
    results.valid = false;
    results.issues.push("Data is not an array or object");
  }

  return results;
}

// Simulated bias analysis (would use a real library in production)
async function runBiasAnalysis(data: any): Promise<any> {
  return new Promise((resolve) => {
    // Simulate processing time
    setTimeout(() => {
      const results = {
        totalRecords: Array.isArray(data) ? data.length : 1,
        biasMetrics: {
          genderBias: Math.random() * 0.5,
          ageBias: Math.random() * 0.4,
          racialBias: Math.random() * 0.3,
          geographicBias: Math.random() * 0.6
        },
        recommendedActions: [
          "Increase diversity in training data",
          "Apply fairness constraints to model",
          "Review feature selection process"
        ],
        detailedAnalysis: {
          featureImportance: {},
          confusionMatrix: {},
          sensitiveAttributes: []
        }
      };

      // If we have array data, try to identify sensitive attributes
      if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object") {
        const firstItem = data[0];
        const sensitiveFields = [];

        // Look for potentially sensitive fields
        for (const [key, value] of Object.entries(firstItem)) {
          const lowerKey = key.toLowerCase();
          if (
            lowerKey.includes("gender") ||
            lowerKey.includes("sex") ||
            lowerKey.includes("race") ||
            lowerKey.includes("ethnic") ||
            lowerKey.includes("age") ||
            lowerKey.includes("nationality") ||
            lowerKey.includes("religion") ||
            lowerKey.includes("disability")
          ) {
            sensitiveFields.push(key);
          }
        }

        results.detailedAnalysis.sensitiveAttributes = sensitiveFields;
      }

      resolve(results);
    }, 2000);
  });
}

// Simulated PII detection (would use Microsoft Presidio in production)
async function runPiiDetection(data: any): Promise<any> {
  return new Promise((resolve) => {
    // Simulate processing time
    setTimeout(() => {
      const flattenData = (obj: any, prefix = ""): any => {
        const result = {};
        
        if (typeof obj !== "object" || obj === null) {
          return { [prefix]: obj };
        }
        
        if (Array.isArray(obj)) {
          obj.forEach((item, index) => {
            const newPrefix = prefix ? `${prefix}[${index}]` : `[${index}]`;
            Object.assign(result, flattenData(item, newPrefix));
          });
          return result;
        }
        
        Object.entries(obj).forEach(([key, value]) => {
          const newPrefix = prefix ? `${prefix}.${key}` : key;
          Object.assign(result, flattenData(value, newPrefix));
        });
        
        return result;
      };

      // Convert data to flat structure for analysis
      const flatData = flattenData(data);
      
      // PII detection patterns (simplified)
      const piiPatterns = {
        email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
        ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/,
        creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/,
        phoneNumber: /\b(?:\+?1[-\s]?)?\(?([0-9]{3})\)?[-\s]?([0-9]{3})[-\s]?([0-9]{4})\b/,
        ipAddress: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/
      };
      
      const piiFindings = [];
      
      for (const [path, value] of Object.entries(flatData)) {
        if (typeof value !== "string") continue;
        
        for (const [piiType, pattern] of Object.entries(piiPatterns)) {
          if (pattern.test(value)) {
            piiFindings.push({
              path,
              type: piiType,
              confidence: 0.9,
              remediation: "Redact or encrypt this field"
            });
            break;
          }
        }
      }
      
      const results = {
        scannedFields: Object.keys(flatData).length,
        piiDetected: piiFindings.length > 0,
        findings: piiFindings,
        summary: {
          highRiskFields: piiFindings.length,
          complianceStatus: piiFindings.length === 0 ? "Compliant" : "Needs Review"
        }
      };
      
      resolve(results);
    }, 1500);
  });
}
