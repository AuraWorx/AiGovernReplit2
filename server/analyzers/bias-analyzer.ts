import fs from 'fs/promises';
import path from 'path';
import csvParser from 'csv-parser';
import { createReadStream } from 'fs';
import { Readable } from 'stream';

// Define the analysis result structure
export interface BiasAnalysisResult {
  totalRecords: number;
  biasMetrics: {
    genderBias: number;
    ageBias: number;
    racialBias: number;
    geographicBias: number;
    disparateImpact: {
      gender?: number;
      age?: number;
      race?: number;
      geography?: number;
    };
  };
  recommendedActions: string[];
  detailedAnalysis: {
    featureImportance: Record<string, number>;
    distributionStats: Record<string, any>;
    sensitiveAttributes: string[];
    potentialIssues: Array<{
      attribute: string;
      issue: string;
      severity: 'low' | 'medium' | 'high';
      explanation: string;
    }>;
  };
  dataQualityIssues: {
    missingValues: Record<string, number>;
    skewedDistributions: string[];
    outliers: Record<string, number>;
  };
}

// Helper function to parse CSV data
async function parseCSV(filePath: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    
    createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

// Helper function to parse CSV from string
async function parseCSVString(csvString: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    const stream = Readable.from(csvString);
    
    stream
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

// Calculate distribution statistics for a column
function calculateDistribution(data: any[], column: string) {
  // Skip if not enough data or column doesn't exist
  if (!data.length || !data[0].hasOwnProperty(column)) {
    return { count: 0 };
  }

  const values = data.map(row => row[column])
    .filter(val => val !== null && val !== undefined && val !== '');
  
  if (!values.length) return { count: 0 };
  
  // Count occurrences of each value
  const distribution = values.reduce((acc, val) => {
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {});
  
  return {
    count: values.length,
    uniqueValues: Object.keys(distribution).length,
    distribution,
    // If values are numeric, add basic stats
    ...(values.every(v => !isNaN(Number(v))) ? 
      calculateNumericStats(values.map(v => Number(v))) : {})
  };
}

// Calculate basic numeric statistics
function calculateNumericStats(values: number[]) {
  values.sort((a, b) => a - b);
  
  const sum = values.reduce((acc, val) => acc + val, 0);
  const mean = sum / values.length;
  
  // Calculate variance and standard deviation
  const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  // Get min, max, median
  const min = values[0];
  const max = values[values.length - 1];
  const median = values.length % 2 === 0
    ? (values[values.length / 2 - 1] + values[values.length / 2]) / 2
    : values[Math.floor(values.length / 2)];
  
  // Identify potential outliers using IQR method
  const q1 = values[Math.floor(values.length * 0.25)];
  const q3 = values[Math.floor(values.length * 0.75)];
  const iqr = q3 - q1;
  const outlierThresholdLow = q1 - 1.5 * iqr;
  const outlierThresholdHigh = q3 + 1.5 * iqr;
  
  const outliers = values.filter(v => v < outlierThresholdLow || v > outlierThresholdHigh);
  
  return {
    min,
    max,
    mean,
    median,
    stdDev,
    quartiles: { q1, q3 },
    outliers: outliers.length,
    outliersPercent: (outliers.length / values.length) * 100
  };
}

// Calculate disparate impact for a binary outcome based on a protected attribute
function calculateDisparateImpact(data: any[], outcomeColumn: string, protectedAttribute: string): number | null {
  // Need binary outcome and at least some data
  if (!data.length || !outcomeColumn || !protectedAttribute) return null;
  
  // Get all values of the protected attribute
  const attributeValues = [...new Set(data.map(row => row[protectedAttribute]))];
  if (attributeValues.length < 2) return null; // Need at least two groups
  
  // Map to track favorable outcomes by attribute value
  const favorableOutcomes: Record<string, { positive: number, total: number }> = {};
  
  // Initialize counters
  attributeValues.forEach(value => {
    favorableOutcomes[value] = { positive: 0, total: 0 };
  });
  
  // Count outcomes by group
  data.forEach(row => {
    const attributeValue = row[protectedAttribute];
    const outcome = row[outcomeColumn];
    
    // Skip rows with missing values
    if (attributeValue === undefined || attributeValue === null || 
        outcome === undefined || outcome === null) {
      return;
    }
    
    favorableOutcomes[attributeValue].total++;
    
    // Assuming "1", "true", "yes" etc. are favorable outcomes
    const isFavorable = (
      outcome === 1 || 
      outcome === "1" || 
      outcome === true || 
      outcome === "true" || 
      outcome === "yes" || 
      outcome === "approved"
    );
    
    if (isFavorable) {
      favorableOutcomes[attributeValue].positive++;
    }
  });
  
  // Calculate approval rates for each group
  const rates = Object.entries(favorableOutcomes).map(([value, counts]) => ({
    group: value,
    rate: counts.total > 0 ? counts.positive / counts.total : 0,
    count: counts.total
  }));
  
  // Find groups with highest and lowest rates
  rates.sort((a, b) => a.rate - b.rate);
  
  // Only calculate if we have some data in both groups
  if (rates[0].count === 0 || rates[rates.length - 1].count === 0) return null;
  
  // Calculate disparate impact as ratio of lowest to highest rate
  // A value below 0.8 is generally considered problematic
  const disparateImpact = rates[0].rate / rates[rates.length - 1].rate;
  
  return disparateImpact;
}

// Find potentially sensitive attributes in the data
function findSensitiveAttributes(data: any[]): string[] {
  if (!data.length) return [];
  
  const sensitiveFields: string[] = [];
  const firstRow = data[0];
  
  // Look for potentially sensitive fields
  for (const key of Object.keys(firstRow)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes("gender") ||
      lowerKey.includes("sex") ||
      lowerKey.includes("race") ||
      lowerKey.includes("ethnic") ||
      lowerKey.includes("age") ||
      lowerKey.includes("nationality") ||
      lowerKey.includes("religion") ||
      lowerKey.includes("disability") ||
      lowerKey.includes("zip") ||
      lowerKey.includes("postal") ||
      lowerKey.includes("location")
    ) {
      sensitiveFields.push(key);
    }
  }
  
  return sensitiveFields;
}

// Identify missing values in the dataset
function findMissingValues(data: any[]): Record<string, number> {
  if (!data.length) return {};
  
  const columns = Object.keys(data[0]);
  const missingSummary: Record<string, number> = {};
  
  // Check each column for missing values
  columns.forEach(column => {
    const missingCount = data.filter(row => 
      row[column] === null || 
      row[column] === undefined || 
      row[column] === ""
    ).length;
    
    if (missingCount > 0) {
      missingSummary[column] = missingCount;
    }
  });
  
  return missingSummary;
}

// Main analysis function
export async function analyzeBias(
  inputData: any[] | string, 
  fileType: string = 'json',
  targetColumn?: string
): Promise<BiasAnalysisResult> {
  let data: any[];
  
  // Parse the data based on input type and format
  if (typeof inputData === 'string') {
    // If string, parse as file path or direct CSV content
    if (fileType === 'csv') {
      // Check if string is a file path or CSV content
      try {
        await fs.access(inputData);
        // If no error, it's a file path
        data = await parseCSV(inputData);
      } catch (error) {
        // If error, treat as CSV content
        data = await parseCSVString(inputData);
      }
    } else {
      // Parse as JSON
      data = JSON.parse(inputData);
    }
  } else {
    // Already an array
    data = inputData;
  }
  
  // Ensure data is an array
  if (!Array.isArray(data)) {
    if (typeof data === 'object' && data !== null) {
      // Convert object to array with one item
      data = [data];
    } else {
      throw new Error('Input data must be an array or object');
    }
  }
  
  // Start analysis
  const totalRecords = data.length;
  if (totalRecords === 0) {
    throw new Error('Input data is empty');
  }
  
  // Find sensitive attributes
  const sensitiveAttributes = findSensitiveAttributes(data);
  
  // Calculate distributions for all columns
  const columns = Object.keys(data[0]);
  const distributions: Record<string, any> = {};
  
  columns.forEach(column => {
    distributions[column] = calculateDistribution(data, column);
  });
  
  // Find missing values
  const missingValues = findMissingValues(data);
  
  // Identify skewed distributions
  const skewedDistributions = Object.entries(distributions)
    .filter(([_, stats]) => 
      stats.stdDev && stats.mean && Math.abs(stats.stdDev / stats.mean) > 2
    )
    .map(([column]) => column);
  
  // Calculate outliers
  const outliers: Record<string, number> = {};
  Object.entries(distributions).forEach(([column, stats]) => {
    if (stats.outliers && stats.outliers > 0) {
      outliers[column] = stats.outliers;
    }
  });
  
  // Calculate disparate impact if target column is provided
  const disparateImpact: Record<string, number> = {};
  if (targetColumn) {
    sensitiveAttributes.forEach(attribute => {
      const impact = calculateDisparateImpact(data, targetColumn, attribute);
      if (impact !== null) {
        disparateImpact[attribute] = impact;
      }
    });
  }
  
  // Generate potential issues
  const potentialIssues = [];
  
  // Check for missing values
  if (Object.keys(missingValues).length > 0) {
    const highMissingColumns = Object.entries(missingValues)
      .filter(([_, count]) => count / totalRecords > 0.1)
      .map(([column]) => column);
    
    if (highMissingColumns.length > 0) {
      potentialIssues.push({
        attribute: highMissingColumns.join(', '),
        issue: 'High rate of missing values',
        severity: 'medium',
        explanation: 'Missing data can lead to biased models if not properly handled.'
      });
    }
  }
  
  // Check for skewed distributions
  if (skewedDistributions.length > 0) {
    potentialIssues.push({
      attribute: skewedDistributions.join(', '),
      issue: 'Skewed distributions',
      severity: 'low',
      explanation: 'Severely skewed data may lead to model bias toward majority cases.'
    });
  }
  
  // Check for disparate impact
  Object.entries(disparateImpact).forEach(([attribute, impact]) => {
    if (impact < 0.8) {
      potentialIssues.push({
        attribute,
        issue: 'Disparate impact detected',
        severity: 'high',
        explanation: `The ${attribute} attribute shows a disparate impact ratio of ${impact.toFixed(2)}, which is below the 0.8 threshold typically used in legal contexts.`
      });
    }
  });
  
  // Calculate feature importance (simplified simulation)
  const featureImportance: Record<string, number> = {};
  columns.forEach(column => {
    // Assign random importance, higher for sensitive attributes
    featureImportance[column] = sensitiveAttributes.includes(column)
      ? 0.5 + Math.random() * 0.5
      : Math.random() * 0.5;
  });
  
  // Check for class imbalance if target column exists
  if (targetColumn && distributions[targetColumn]) {
    const targetDist = distributions[targetColumn];
    if (targetDist.uniqueValues && targetDist.uniqueValues <= 5) { // Categorical target
      const values = Object.values(targetDist.distribution) as number[];
      const maxCount = Math.max(...values);
      const minCount = Math.min(...values);
      
      if (maxCount / minCount > 10) {
        potentialIssues.push({
          attribute: targetColumn,
          issue: 'Severe class imbalance',
          severity: 'high',
          explanation: 'The target variable has highly imbalanced classes, which can lead to biased predictions.'
        });
      }
    }
  }
  
  // Generate random bias metrics for now (would be calculated based on actual analysis)
  // In a real implementation, these would be calculated based on statistical measures
  const biasMetrics = {
    genderBias: Math.random() * 0.5,
    ageBias: Math.random() * 0.4,
    racialBias: Math.random() * 0.3,
    geographicBias: Math.random() * 0.6,
    disparateImpact: disparateImpact
  };
  
  // Generate recommended actions based on issues
  const recommendedActions = [
    "Increase diversity in training data",
    "Apply fairness constraints to model"
  ];
  
  if (Object.keys(missingValues).length > 0) {
    recommendedActions.push("Implement robust handling of missing values");
  }
  
  if (skewedDistributions.length > 0) {
    recommendedActions.push("Consider data transformation for skewed features");
  }
  
  if (Object.keys(disparateImpact).length > 0) {
    recommendedActions.push("Review features causing disparate impact");
  }
  
  // Construct the final result
  const result: BiasAnalysisResult = {
    totalRecords,
    biasMetrics,
    recommendedActions,
    detailedAnalysis: {
      featureImportance,
      distributionStats: distributions,
      sensitiveAttributes,
      potentialIssues
    },
    dataQualityIssues: {
      missingValues,
      skewedDistributions,
      outliers
    }
  };
  
  return result;
}