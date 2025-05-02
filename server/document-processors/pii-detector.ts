import { ExtractedDocument } from './document-parser';
import { log } from '../vite';

/**
 * Types of PII that can be detected
 */
export enum PiiType {
  EMAIL = 'email',
  PHONE_NUMBER = 'phone_number',
  CREDIT_CARD = 'credit_card',
  SSN = 'social_security_number',
  IP_ADDRESS = 'ip_address',
  US_ADDRESS = 'us_address',
  PASSPORT_NUMBER = 'passport_number',
  DRIVING_LICENSE = 'driving_license',
  PERSON_NAME = 'person_name',
  DATE_OF_BIRTH = 'date_of_birth'
}

/**
 * A detected PII finding
 */
export interface PiiFinding {
  type: PiiType;
  value: string;
  confidence: number;
  path: string;
  filename: string;
  location: {
    startIndex: number;
    endIndex: number;
  };
  context?: string;
}

/**
 * Regular expressions for detecting different types of PII
 */
const PII_PATTERNS = {
  // Email regex - matches common email formats
  [PiiType.EMAIL]: {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    confidence: 0.9
  },
  
  // Phone number regex - matches various US phone formats
  [PiiType.PHONE_NUMBER]: {
    pattern: /\b(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
    confidence: 0.85
  },
  
  // Credit card regex - matches common credit card formats
  [PiiType.CREDIT_CARD]: {
    pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b/g,
    confidence: 0.95
  },
  
  // SSN regex - matches social security number formats
  [PiiType.SSN]: {
    pattern: /\b(?!000|666|9\d{2})([0-8]\d{2}|7([0-6]\d|7[012]))([-\s]?)(?!00)\d\d\3(?!0000)\d{4}\b/g,
    confidence: 0.95
  },
  
  // IP address regex - matches IPv4 and IPv6
  [PiiType.IP_ADDRESS]: {
    pattern: /\b((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b|\b([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}\b/g,
    confidence: 0.8
  },
  
  // US Address pattern - simplified for demonstration
  [PiiType.US_ADDRESS]: {
    pattern: /\b\d{1,5}\s[A-Z][a-z]+(?:\s[A-Z][a-z]+)*,\s[A-Z]{2}\s\d{5}(?:-\d{4})?\b/g,
    confidence: 0.7
  },
  
  // Passport number - simplified pattern
  [PiiType.PASSPORT_NUMBER]: {
    pattern: /\b[A-Z]{1,2}[0-9]{6,9}\b/g,
    confidence: 0.7
  },
  
  // Driver's license - simplified pattern for US
  [PiiType.DRIVING_LICENSE]: {
    pattern: /\b[A-Z][0-9]{3,8}\b/g,
    confidence: 0.6 // Lower confidence due to potential false positives
  },
  
  // Person's name - simple pattern, would need more complex logic for production
  [PiiType.PERSON_NAME]: {
    pattern: /\b[A-Z][a-z]+\s[A-Z][a-z]+\b/g,
    confidence: 0.5 // Low confidence due to many false positives
  },
  
  // Date of birth - common formats
  [PiiType.DATE_OF_BIRTH]: {
    pattern: /\b(0[1-9]|1[0-2])[\/](0[1-9]|[12]\d|3[01])[\/](19|20)\d{2}\b/g,
    confidence: 0.7
  }
};

/**
 * Get surrounding context for a PII finding
 */
function getContext(text: string, startIndex: number, endIndex: number, contextSize = 30): string {
  const contextStart = Math.max(0, startIndex - contextSize);
  const contextEnd = Math.min(text.length, endIndex + contextSize);
  
  let context = text.slice(contextStart, contextEnd);
  
  // Add ellipsis if context is truncated
  if (contextStart > 0) context = '...' + context;
  if (contextEnd < text.length) context = context + '...';
  
  // Replace the actual PII with asterisks in the context
  const piiText = text.slice(startIndex, endIndex);
  const piiLength = endIndex - startIndex;
  const asterisks = '*'.repeat(piiLength);
  
  // Calculate where in the context the PII is located
  const piiContextStart = startIndex - contextStart;
  
  return (
    context.slice(0, piiContextStart) + 
    asterisks + 
    context.slice(piiContextStart + piiLength)
  );
}

/**
 * Detect PII in a document
 */
export function detectPii(document: ExtractedDocument): PiiFinding[] {
  const findings: PiiFinding[] = [];
  const text = document.text;
  
  // Apply each PII pattern
  for (const [type, detector] of Object.entries(PII_PATTERNS)) {
    const matches = text.matchAll(detector.pattern);
    
    for (const match of matches) {
      if (match.index !== undefined) {
        const startIndex = match.index;
        const endIndex = startIndex + match[0].length;
        
        findings.push({
          type: type as PiiType,
          value: match[0],
          confidence: detector.confidence,
          path: document.path,
          filename: document.filename,
          location: {
            startIndex,
            endIndex
          },
          context: getContext(text, startIndex, endIndex)
        });
      }
    }
  }
  
  return findings;
}

/**
 * Process a batch of documents for PII detection
 */
export function detectPiiInDocuments(documents: ExtractedDocument[]): {
  findings: PiiFinding[];
  totalDocuments: number;
  processedDocuments: number;
  piiDetected: boolean;
  documentSummary: {
    filename: string;
    fileType: string;
    piiCount: number;
  }[];
} {
  let allFindings: PiiFinding[] = [];
  let processedDocuments = 0;
  const documentSummary: {
    filename: string;
    fileType: string;
    piiCount: number;
  }[] = [];
  
  for (const document of documents) {
    try {
      const findings = detectPii(document);
      allFindings = [...allFindings, ...findings];
      
      documentSummary.push({
        filename: document.filename,
        fileType: document.fileType,
        piiCount: findings.length
      });
      
      processedDocuments++;
    } catch (error) {
      log(`Error processing document ${document.filename} for PII detection: ${error}`, 'pii-detector');
    }
  }
  
  return {
    findings: allFindings,
    totalDocuments: documents.length,
    processedDocuments,
    piiDetected: allFindings.length > 0,
    documentSummary
  };
}