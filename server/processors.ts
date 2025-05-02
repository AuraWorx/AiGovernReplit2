import { storage } from "./storage";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { queueAnalysisJob } from "./jobs/analysis-processor";
import { initAnalysisProcessor } from "./jobs/analysis-processor";
import { analyzeBias } from "./analyzers/bias-analyzer";

// Initialize the analysis processor
initAnalysisProcessor();

interface ProcessOptions {
  source: "upload" | "webhook";
  datasetId?: number;
  webhookDataId?: number;
  analysisType?: string;
  tenantId: number;
  initiatedById: number;
}

// Process uploaded data or webhook data - now queues the job
export async function processData(options: ProcessOptions): Promise<any> {
  const { source, datasetId, webhookDataId, analysisType = "bias_analysis", tenantId, initiatedById } = options;
  
  try {
    console.log(`Queueing ${analysisType} analysis job for ${source === "upload" ? `dataset ${datasetId}` : `webhook data ${webhookDataId}`}`);
    
    // Queue the analysis job
    const analysisId = await queueAnalysisJob({
      source,
      datasetId,
      webhookDataId,
      analysisType,
      tenantId,
      initiatedById
    });
    
    // Get the created analysis record
    const analysis = await storage.getAnalysis(analysisId, tenantId);
    
    return analysis;
  } catch (error) {
    console.error(`Error queueing analysis job:`, error);
    throw error;
  }
}

// Simple data validation
export function validateData(data: any): any {
  // Basic validation
  const results: {
    valid: boolean;
    records: number;
    issues: string[];
    summary: Record<string, any>;
  } = {
    valid: true,
    records: Array.isArray(data) ? data.length : 1,
    issues: [],
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
      
      fields.forEach(field => {
        results.summary[field] = {
          type: typeof data[0][field],
          sampleValues: data.slice(0, 3).map(item => item[field])
        };
      });
    }
  } else if (typeof data === "object" && data !== null) {
    // For single JSON objects
    Object.keys(data).forEach(key => {
      results.summary[key] = {
        type: typeof data[key],
        value: data[key]
      };
    });
  } else {
    results.valid = false;
    results.issues.push("Data is not an array or object");
  }

  return results;
}

// Simulated PII detection (would use Microsoft Presidio in production)
export async function runPiiDetection(data: any): Promise<any> {
  return new Promise((resolve) => {
    // Simulate processing time
    setTimeout(() => {
      const flattenData = (obj: any, prefix = ""): Record<string, any> => {
        const result: Record<string, any> = {};
        
        if (typeof obj !== "object" || obj === null) {
          result[prefix] = obj;
          return result;
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
      const piiPatterns: Record<string, RegExp> = {
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
