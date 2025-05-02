import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { log } from '../vite';
import { parseDocument, processDirectory, ExtractedDocument } from './document-parser';
import { detectPiiInDocuments } from './pii-detector';
import { storage } from '../storage';

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage for multer
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create tenant-specific directory
    const tenantId = req.user?.tenantId || 1;
    const tenantDir = path.join(uploadDir, `tenant_${tenantId}`);
    
    if (!fs.existsSync(tenantDir)) {
      fs.mkdirSync(tenantDir, { recursive: true });
    }
    
    cb(null, tenantDir);
  },
  filename: (req, file, cb) => {
    // Generate a unique filename with timestamp
    const timestamp = Date.now();
    const originalName = file.originalname;
    cb(null, `${timestamp}-${originalName}`);
  }
});

// File filter to accept only supported file types
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'application/json'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}`));
  }
};

// Create multer instance
export const upload = multer({
  storage: diskStorage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

/**
 * Handle file upload and PII detection
 */
export async function handleFileUpload(req: Request, res: Response) {
  try {
    if (!req.file && !req.files) {
      return res.status(400).json({ error: 'No files were uploaded' });
    }
    
    const tenantId = req.user?.tenantId || 1;
    const userId = req.user?.id || 1;
    let documents: ExtractedDocument[] = [];
    
    // Create a dataset record
    const dataset = await storage.createDataset({
      name: req.body.name || `Document Upload - ${new Date().toISOString()}`,
      description: req.body.description || 'Uploaded for PII detection',
      source: 'file_upload',
      tenantId,
      createdById: userId,
      metadata: {
        fileCount: req.files ? (req.files as Express.Multer.File[]).length : 1
      }
    });
    
    // Log activity
    await storage.logActivity({
      action: 'dataset_created',
      description: `Dataset "${dataset.name}" created from document upload`,
      tenantId,
      userId,
      resourceId: dataset.id,
      resourceType: 'dataset'
    });
    
    // Process single file
    if (req.file) {
      const doc = await parseDocument(req.file.path);
      documents = [doc];
    }
    // Process multiple files
    else if (req.files && Array.isArray(req.files)) {
      const files = req.files as Express.Multer.File[];
      documents = await Promise.all(
        files.map(file => parseDocument(file.path))
      );
    }
    // Process folder upload (if it's a directory)
    else if (req.body.isDirectory && req.body.directoryPath) {
      const dirPath = path.join(uploadDir, `tenant_${tenantId}`, req.body.directoryPath);
      if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
        documents = await processDirectory(dirPath);
      }
    }
    
    // Create analysis record
    const analysis = await storage.createAnalysis({
      name: `pii_detection - ${new Date().toISOString()}`,
      analysisType: 'pii_detection',
      status: 'pending',
      tenantId,
      datasetId: dataset.id,
      initiatedById: userId,
      metadata: {
        documentCount: documents.length
      }
    });
    
    // Queue analysis job
    processDocumentAnalysis(documents, analysis.id, tenantId, userId);
    
    return res.status(201).json({
      message: 'Files uploaded and PII detection started',
      datasetId: dataset.id,
      analysisId: analysis.id,
      documentCount: documents.length
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Error handling file upload: ${error}`, 'upload-handler');
    return res.status(500).json({ error: `File upload failed: ${errorMessage}` });
  }
}

/**
 * Process document analysis asynchronously
 */
async function processDocumentAnalysis(
  documents: ExtractedDocument[],
  analysisId: number,
  tenantId: number,
  userId: number
) {
  try {
    // Update analysis status to processing
    await storage.updateAnalysisStatus(analysisId, 'processing');
    
    // Log activity
    await storage.logActivity({
      action: 'analysis_started',
      description: `PII detection analysis started on ${documents.length} documents`,
      tenantId,
      userId,
      resourceId: analysisId,
      resourceType: 'analysis'
    });
    
    // Perform PII detection
    const results = detectPiiInDocuments(documents);
    
    // Store results
    const resultsDir = path.join(uploadDir, `tenant_${tenantId}`, 'results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    const resultsPath = path.join(resultsDir, `pii_analysis_${analysisId}.json`);
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    
    // Update analysis status to completed
    await storage.updateAnalysisStatus(analysisId, 'completed', resultsPath);
    
    // Log activity
    await storage.logActivity({
      action: 'analysis_completed',
      description: `PII detection completed, found ${results.findings.length} instances of PII in ${results.processedDocuments} documents`,
      tenantId,
      userId,
      resourceId: analysisId,
      resourceType: 'analysis'
    });
    
    log(`PII detection completed for analysis ID ${analysisId}`, 'upload-handler');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Error processing document analysis: ${error}`, 'upload-handler');
    
    // Update analysis status to failed
    await storage.updateAnalysisStatus(analysisId, 'failed');
    
    // Log activity
    await storage.logActivity({
      action: 'analysis_failed',
      description: `PII detection failed: ${errorMessage}`,
      tenantId,
      userId,
      resourceId: analysisId,
      resourceType: 'analysis'
    });
  }
}