import type { Express, Request, Response, NextFunction } from "express"; // Use specific types
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { handleWebhookRequest, createWebhook, getWebhooks, getWebhook } from "./webhooks";
import { queueAnalysisJob } from "./jobs/analysis-processor"; // Use the queueing function
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"; // For presigned URLs
import { log } from "./utils/logger";
import { nanoid } from "nanoid";
import type { User } from "@shared/schema"; // Import User type

// --- S3 Client Setup ---
const awsRegion = process.env.AWS_REGION;
const uploadsBucket = process.env.S3_UPLOADS_BUCKET_NAME;
const resultsBucket = process.env.S3_RESULTS_BUCKET_NAME; // For analysis results

if (!awsRegion) {
    log("Warning: AWS_REGION environment variable not set. Using default 'us-west-2'.", "s3-setup");
}
if (!uploadsBucket) {
    log("FATAL: S3_UPLOADS_BUCKET_NAME environment variable not set!", "s3-setup");
    throw new Error("S3_UPLOADS_BUCKET_NAME is required.");
}
// Results bucket is optional for now
if (!resultsBucket) {
    log("Info: S3_RESULTS_BUCKET_NAME environment variable not set. Analysis results will not be stored in S3.", "s3-setup");
}

const s3Client = new S3Client({ region: awsRegion || "us-west-2" });

// --- Multer Configuration (Memory Storage) ---
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit (adjust as needed)
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
        'text/csv', 'application/json', 'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
        'application/msword', // doc
        'text/plain'
    ];
     if (allowedTypes.includes(file.mimetype)) {
       cb(null, true);
     } else {
       log(`Upload rejected: Unsupported file type ${file.mimetype}`, 'upload-filter');
       cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: ${allowedTypes.join(', ')}`));
     }
  }
});

// --- Authentication Middleware ---
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated() || !req.user) { // Check both isAuthenticated and req.user
      return res.status(401).json({ message: "Authentication required" });
    }
    // Ensure tenantId exists on the user object
    if (typeof (req.user as User).tenantId === 'undefined') {
        log('Authentication successful but tenantId missing from user object.', 'auth-middleware');
        return res.status(500).json({ message: 'Authentication context error.' }); // Internal error if tenantId is missing post-auth
    }
    next();
};

// Helper to get tenant ID safely
const getTenantId = (req: Request): number => {
    // requireAuth ensures req.user exists and has tenantId
    return (req.user as User).tenantId;
};
// Helper to get user ID safely
const getUserId = (req: Request): number => {
     // requireAuth ensures req.user exists
    return (req.user as User).id;
}

// --- Route Registration ---
export async function registerRoutes(app: Express): Promise<Server> {
  // Setup Authentication FIRST (includes CORS)
  await setupAuth(app);

  // --- Health Check ---
  app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // --- Tenant Routes ---
  app.get("/api/tenant", requireAuth, async (req, res, next) => {
    try {
      const tenantId = getTenantId(req);
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        // This case should ideally not happen if user belongs to a valid tenant
        log(`Tenant not found for ID: ${tenantId}`, 'tenant-route-error');
        return res.status(404).json({ message: "Tenant not found" });
      }
      res.json(tenant);
    } catch (error) {
      log(`Error fetching tenant: ${error}`, 'tenant-route-error');
      next(error); // Pass to global error handler
    }
  });

  // Get all tenants (Example: Admin only)
  app.get("/api/tenants", requireAuth, async (req, res, next) => {
    try {
      // Example role check (adjust based on your roles)
      if ((req.user as User).role !== "admin") {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }
      const tenants = await storage.getTenants();
      res.json(tenants);
    } catch (error) {
      log(`Error fetching all tenants: ${error}`, 'tenant-route-error');
      next(error);
    }
  });

  // Create tenant (Example: Admin only)
  app.post("/api/tenants", requireAuth, async (req, res, next) => {
     try {
       if ((req.user as User).role !== "admin") {
         return res.status(403).json({ message: "Forbidden: Admin access required" });
       }
       const { name, schemaName } = req.body;
       if (!name || !schemaName) {
         return res.status(400).json({ message: "Name and schema name are required" });
       }
       const tenant = await storage.createTenant(name, schemaName);
       res.status(201).json(tenant);
     } catch (error) {
        log(`Error creating tenant: ${error}`, 'tenant-route-error');
       next(error);
     }
   });


  // --- Dataset Routes ---

  // Dataset File Upload (Refactored for S3)
  app.post("/api/datasets/upload", requireAuth, memoryUpload.single("file"), async (req, res, next) => {
    if (!uploadsBucket) {
      log('Upload attempt failed: S3 uploads bucket not configured', 'upload-route');
      return res.status(500).json({ message: "Server configuration error: Uploads not enabled." });
    }
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { name, description, analysisType } = req.body;
      const tenantId = getTenantId(req);
      const userId = getUserId(req);

      if (!name) {
        return res.status(400).json({ message: "Dataset name is required" });
      }

      // Generate a unique S3 key: tenant_{id}/datasets/{nanoid}.{ext}
      const fileExtension = path.extname(req.file.originalname) || '';
      const s3Key = `tenant_${tenantId}/datasets/${nanoid()}${fileExtension}`;

      log(`Uploading dataset '${name}' to s3://${uploadsBucket}/${s3Key} for tenant ${tenantId}`, 'upload-route');

      // Use S3 Upload utility for efficient uploads
      const upload = new Upload({
         client: s3Client,
         params: {
           Bucket: uploadsBucket,
           Key: s3Key,
           Body: req.file.buffer,
           ContentType: req.file.mimetype,
           Metadata: {
             'original-filename': req.file.originalname,
             'upload-timestamp': new Date().toISOString(),
             'user-id': String(userId),
             'tenant-id': String(tenantId),
           }
         },
       });

       await upload.done();
       log(`Successfully uploaded dataset to ${s3Key}`, 'upload-route');

      // Create dataset record in DB
      const dataset = await storage.createDataset({
        name,
        description: description || null,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        s3Bucket: uploadsBucket,
        s3Key: s3Key,
        uploadedById: userId,
        tenantId: tenantId
      });

      // Log activity
      await storage.logActivity({
        action: "dataset_uploaded",
        description: `Uploaded dataset: ${name} (S3: ${s3Key})`,
        entityType: "dataset",
        entityId: dataset.id,
        tenantId: tenantId,
        userId: userId
      });

      // Queue analysis job if requested
      if (analysisType) {
        log(`Queueing analysis job (${analysisType}) for new dataset ${dataset.id}`, 'upload-route');
        queueAnalysisJob({ // Use the dedicated queueing function
          source: "upload",
          datasetId: dataset.id,
          analysisType,
          tenantId: tenantId,
          initiatedById: userId
        }).catch(error => {
          log(`Error queueing analysis job for dataset ${dataset.id}: ${error}`, 'upload-route-error');
          // Decide how to handle this - maybe update dataset status or log prominently
        });
      }

      // Return dataset info (excluding S3 details from client response)
       const { s3Bucket: _, s3Key: __, ...datasetResponse } = dataset;
       res.status(201).json(datasetResponse);

    } catch (error) {
      log(`Error handling dataset upload: ${error}`, 'upload-route-error');
      next(error); // Pass to global error handler
    }
  });

  // Get Datasets List
  app.get("/api/datasets", requireAuth, async (req, res, next) => {
    try {
      const tenantId = getTenantId(req);
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const datasets = await storage.getDatasets(tenantId, limit);
      // Remove S3 details before sending
      const sanitizedDatasets = datasets.map(d => {
          const { s3Bucket, s3Key, ...rest } = d;
          return rest;
      });
      res.json(sanitizedDatasets);
    } catch (error) {
      log(`Error fetching datasets for tenant ${getTenantId(req)}: ${error}`, 'dataset-route-error');
      next(error);
    }
  });

  // Get Single Dataset (potentially add presigned URL for download)
  app.get("/api/datasets/:id", requireAuth, async (req, res, next) => {
    try {
      const tenantId = getTenantId(req);
      const datasetId = parseInt(req.params.id, 10);
      if (isNaN(datasetId)) {
        return res.status(400).json({ message: "Invalid dataset ID" });
      }

      const dataset = await storage.getDataset(datasetId, tenantId);
      if (!dataset) {
        return res.status(404).json({ message: "Dataset not found" });
      }

      // Add presigned URL for download if S3 info exists
      let downloadUrl = null;
      if (dataset.s3Bucket && dataset.s3Key) {
          try {
              const command = new GetObjectCommand({
                  Bucket: dataset.s3Bucket,
                  Key: dataset.s3Key,
                  // Optionally force download filename
                  ResponseContentDisposition: `attachment; filename="${dataset.fileName}"`
              });
              downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // URL valid for 1 hour
          } catch (urlError) {
              log(`Error generating presigned URL for dataset ${datasetId}: ${urlError}`, 's3-error');
              // Proceed without download URL, or handle error differently
          }
      }

      // Remove S3 details, add download URL
      const { s3Bucket, s3Key, ...datasetResponse } = dataset;
      res.json({ ...datasetResponse, downloadUrl });

    } catch (error) {
      log(`Error fetching dataset ${req.params.id} for tenant ${getTenantId(req)}: ${error}`, 'dataset-route-error');
      next(error);
    }
  });

  // --- Webhook Routes (Keep existing logic) ---
  app.post("/api/webhooks", requireAuth, createWebhook);
  app.get("/api/webhooks", requireAuth, getWebhooks);
  app.get("/api/webhooks/:id", requireAuth, getWebhook);
  // Public endpoint - No requireAuth here
  app.post("/api/webhook-receiver/:id", handleWebhookRequest);

  // --- Analysis Routes ---

  // Start Analysis on Existing Dataset
  app.post("/api/analyses", requireAuth, async (req, res, next) => {
     try {
       const tenantId = getTenantId(req);
       const userId = getUserId(req);
       const { datasetId, analysisType } = req.body;

       if (!datasetId || !analysisType) {
         return res.status(400).json({ message: "Dataset ID and analysis type are required" });
       }

       // Verify dataset exists and belongs to the tenant
       const dataset = await storage.getDataset(datasetId, tenantId);
       if (!dataset) {
         return res.status(404).json({ message: "Dataset not found or not accessible" });
       }
       // Ensure dataset has S3 info needed for processing
       if (!dataset.s3Key || !dataset.s3Bucket) {
            log(`Dataset ${datasetId} missing S3 info, cannot start analysis.`, 'analysis-route');
            return res.status(400).json({ message: "Dataset is not properly configured for analysis." });
       }

       log(`Queueing analysis (${analysisType}) for existing dataset ${datasetId} by user ${userId}`, 'analysis-route');
       const analysisId = await queueAnalysisJob({
         source: "upload", // Source is still the uploaded dataset
         datasetId,
         analysisType,
         tenantId: tenantId,
         initiatedById: userId
       });

       // Fetch the created analysis record to return its initial state
       const analysis = await storage.getAnalysis(analysisId, tenantId);
       if (!analysis) {
           // Should not happen if queueAnalysisJob succeeded, but handle defensively
           log(`Failed to fetch analysis record ${analysisId} immediately after queueing`, 'analysis-route-error');
           return res.status(500).json({ message: "Failed to create analysis record." });
       }
       res.status(201).json(analysis); // Return the 'queued' analysis record

     } catch (error) {
       log(`Error starting analysis via API: ${error}`, 'analysis-route-error');
       next(error);
     }
   });

  // Get Analyses List
  app.get("/api/analyses", requireAuth, async (req, res, next) => {
    try {
      const tenantId = getTenantId(req);
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const analyses = await storage.getAnalyses(tenantId, limit);
      res.json(analyses); // Frontend will handle interpreting resultsPath
    } catch (error) {
      log(`Error fetching analyses for tenant ${getTenantId(req)}: ${error}`, 'analysis-route-error');
      next(error);
    }
  });

  // Get Single Analysis (Potentially add presigned URL for results)
  app.get("/api/analyses/:id", requireAuth, async (req, res, next) => {
     try {
       const tenantId = getTenantId(req);
       const analysisId = parseInt(req.params.id, 10);
       if (isNaN(analysisId)) {
         return res.status(400).json({ message: "Invalid analysis ID" });
       }

       const analysis = await storage.getAnalysis(analysisId, tenantId);
       if (!analysis) {
         return res.status(404).json({ message: "Analysis not found" });
       }

       let resultsUrl = null;
       // Check if results are completed and stored in S3
       if (analysis.status === "completed" && analysis.resultsPath?.startsWith('s3://') && resultsBucket) {
           try {
               // Extract bucket and key from the stored path
               const urlParts = new URL(analysis.resultsPath);
               const resultsKey = urlParts.pathname.substring(1); // Remove leading '/'

               const command = new GetObjectCommand({
                   Bucket: resultsBucket, // Use the dedicated results bucket
                   Key: resultsKey,
               });
               resultsUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour validity
               log(`Generated presigned URL for analysis results ${analysisId}`, 'analysis-route');
           } catch (urlError) {
               log(`Error generating presigned URL for analysis results ${analysisId}: ${urlError}`, 's3-error');
               // Proceed without results URL
           }
       } else if (analysis.status === "completed") {
           log(`Analysis ${analysisId} completed, but results not stored in S3 or bucket not configured. Path: ${analysis.resultsPath}`, 'analysis-route');
       }

       // Add the results URL to the response if generated
       res.json({ ...analysis, resultsUrl });

     } catch (error) {
       log(`Error fetching analysis ${req.params.id} for tenant ${getTenantId(req)}: ${error}`, 'analysis-route-error');
       next(error);
     }
   });

  // --- Activity & User Routes (Keep existing logic) ---
  app.get("/api/activities", requireAuth, async (req, res, next) => {
    try {
        const tenantId = getTenantId(req);
        const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50; // Default limit
        const activities = await storage.getActivities(tenantId, limit);
        res.json(activities);
    } catch (error) {
        log(`Error fetching activities for tenant ${getTenantId(req)}: ${error}`, 'activity-route-error');
        next(error);
    }
  });

  app.get("/api/users", requireAuth, async (req, res, next) => {
    try {
        const requestingUser = req.user as User;
        // Example role check - adjust roles as needed
        if (requestingUser.role !== "admin" && requestingUser.role !== "manager") {
            return res.status(403).json({ message: "Forbidden: Insufficient permissions" });
        }
        const tenantId = getTenantId(req);
        const users = await storage.getUsers(tenantId); // getUsers should already omit passwords
        res.json(users);
    } catch (error) {
        log(`Error fetching users for tenant ${getTenantId(req)}: ${error}`, 'user-route-error');
        next(error);
    }
  });

  // Create the HTTP server instance from the Express app
  const httpServer = createServer(app);
  log("HTTP server created, routes registered.", "server-setup");
  return httpServer;
}
