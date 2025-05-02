import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import { log } from '../vite';
import { parsePdf as parsePdfFromLib } from './pdf-parser';

/**
 * Interface for the extracted document content
 */
export interface ExtractedDocument {
  text: string;
  metadata?: Record<string, any>;
  path: string;
  filename: string;
  fileType: string;
}

/**
 * Parse a PDF document and extract its text content
 */
export async function parsePdf(filePath: string): Promise<ExtractedDocument> {
  try {
    const data = await parsePdfFromLib(filePath);
    
    return {
      text: data.text,
      metadata: {
        info: data.info,
        pageCount: data.numpages
      },
      path: filePath,
      filename: path.basename(filePath),
      fileType: 'pdf'
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Error parsing PDF file ${filePath}: ${errorMessage}`, 'document-parser');
    throw new Error(`Failed to parse PDF: ${errorMessage}`);
  }
}

/**
 * Parse a DOCX document and extract its text content
 */
export async function parseDocx(filePath: string): Promise<ExtractedDocument> {
  try {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    
    return {
      text: result.value,
      metadata: {
        messages: result.messages
      },
      path: filePath,
      filename: path.basename(filePath),
      fileType: 'docx'
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Error parsing DOCX file ${filePath}: ${errorMessage}`, 'document-parser');
    throw new Error(`Failed to parse DOCX: ${errorMessage}`);
  }
}

/**
 * Parse a plain text document
 */
export function parseText(filePath: string): ExtractedDocument {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    return {
      text: content,
      path: filePath,
      filename: path.basename(filePath),
      fileType: 'txt'
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Error parsing text file ${filePath}: ${errorMessage}`, 'document-parser');
    throw new Error(`Failed to parse text file: ${errorMessage}`);
  }
}

/**
 * Parse a JSON document
 */
export function parseJson(filePath: string): ExtractedDocument {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const jsonData = JSON.parse(content);
    
    // Convert JSON to string for PII scanning
    const jsonText = JSON.stringify(jsonData, null, 2);
    
    return {
      text: jsonText,
      metadata: {
        structure: Object.keys(jsonData)
      },
      path: filePath,
      filename: path.basename(filePath),
      fileType: 'json'
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Error parsing JSON file ${filePath}: ${errorMessage}`, 'document-parser');
    throw new Error(`Failed to parse JSON file: ${errorMessage}`);
  }
}

/**
 * Parse a document based on its file extension
 */
export async function parseDocument(filePath: string): Promise<ExtractedDocument> {
  const ext = path.extname(filePath).toLowerCase();
  
  switch (ext) {
    case '.pdf':
      return await parsePdf(filePath);
    case '.docx':
    case '.doc':
      return await parseDocx(filePath);
    case '.txt':
      return parseText(filePath);
    case '.json':
      return parseJson(filePath);
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
}

/**
 * Process multiple documents from a directory
 */
export async function processDirectory(dirPath: string): Promise<ExtractedDocument[]> {
  try {
    const files = fs.readdirSync(dirPath);
    const documents: ExtractedDocument[] = [];
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isDirectory()) {
        // Recursively process subdirectories
        const subDocs = await processDirectory(filePath);
        documents.push(...subDocs);
      } else {
        try {
          const ext = path.extname(file).toLowerCase();
          if (['.pdf', '.docx', '.doc', '.txt', '.json'].includes(ext)) {
            const doc = await parseDocument(filePath);
            documents.push(doc);
          }
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          log(`Skipping file ${file}: ${errorMessage}`, 'document-parser');
        }
      }
    }
    
    return documents;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Error processing directory ${dirPath}: ${errorMessage}`, 'document-parser');
    throw new Error(`Failed to process directory: ${errorMessage}`);
  }
}