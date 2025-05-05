// server/processors.ts

// This file is now simplified. The core job queuing logic is in analysis-processor.ts
// We just re-export the function for potential compatibility or clearer import paths.

import { queueAnalysisJob as queueJob } from "./jobs/analysis-processor";
import { log } from "./utils/logger";

/**
 * Queues an analysis job.
 * @deprecated Prefer importing queueAnalysisJob directly from './jobs/analysis-processor'
 */
export const processData = queueJob;

// --- Keep general utility functions here if desired ---

/**
 * Basic data validation (example).
 * @param data Data to validate (array or object)
 * @returns Validation results
 */
export function validateData(data: any): { valid: boolean; records: number; issues: string[]; summary: Record<string, any>; } {
  log('Validating data structure (basic check)', 'data-validation');
  const results = {
    valid: true,
    records: Array.isArray(data) ? data.length : (typeof data === 'object' && data !== null ? 1 : 0),
    issues: [] as string[],
    summary: {} as Record<string, any>
  };

  if (!Array.isArray(data) && (typeof data !== "object" || data === null)) {
    results.valid = false;
    results.issues.push("Data is not a valid array or object");
    return results;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      // An empty array might be valid depending on context, maybe just a warning?
      // results.valid = false;
      results.issues.push("Warning: Empty dataset array provided.");
    } else if (data.length > 1 && typeof data[0] === 'object' && data[0] !== null) {
      // Check for key consistency in arrays of objects
      const firstItemKeys = Object.keys(data[0]).sort().join(",");
      for (let i = 1; i < data.length; i++) {
         if (typeof data[i] !== 'object' || data[i] === null) {
             results.valid = false;
             results.issues.push(`Inconsistent data structure: Item at index ${i} is not an object.`);
             break;
         }
        const currentKeys = Object.keys(data[i]).sort().join(",");
        if (currentKeys !== firstItemKeys) {
          // This might be too strict; consider if varying keys are allowed
          results.issues.push(`Warning: Inconsistent object keys detected starting at index ${i}.`);
          // results.valid = false; // Uncomment if strict consistency is required
          break;
        }
      }
    }
    // Generate summary for array (first few items)
    if (data.length > 0 && typeof data[0] === "object" && data[0] !== null) {
        const fields = Object.keys(data[0]);
        fields.forEach(field => {
            results.summary[field] = {
                type: typeof data[0][field],
                sampleValues: data.slice(0, 3).map(item => item ? item[field] : undefined) // Handle potential null items
            };
        });
    } else if (data.length > 0) {
         results.summary['array_item_type'] = typeof data[0];
         results.summary['sampleValues'] = data.slice(0, 3);
    }

  } else { // Single object
    Object.keys(data).forEach(key => {
      results.summary[key] = {
        type: typeof data[key],
        // Avoid logging large values in summary
        value: String(data[key]).length > 50 ? String(data[key]).substring(0, 47) + '...' : data[key]
      };
    });
  }

  log(`Data validation complete. Valid: ${results.valid}, Issues: ${results.issues.length}`, 'data-validation');
  return results;
}

// Note: The runPiiDetection function previously here is likely obsolete
// as PII detection should be part of the analysis job processor,
// operating on data fetched from S3 or webhook payload.
// Keep it only if it serves a different, specific purpose.
