import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import fs from "fs/promises";
import path from "path";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { handleWebhookRequest, createWebhook, getWebhooks, getWebhook } from "./webhooks";
import { processData } from "./processors";

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: async function (req, file, cb) {
      const uploadDir = path.join(process.cwd(), "uploads");
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept only CSV and JSON files
    if (
      file.mimetype === "text/csv" ||
      file.mimetype === "application/json"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV and JSON files are allowed"));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication
  setupAuth(app);

  // Authentication middleware for protected routes
  const requireAuth = (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }
    next();
  };

  // Health check
  app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // Get current user's tenant
  app.get("/api/tenant", requireAuth, async (req, res) => {
    try {
      const tenant = await storage.getTenant(req.user.tenantId);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }
      res.json(tenant);
    } catch (error) {
      console.error("Error fetching tenant:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get all tenants (admin only)
  app.get("/api/tenants", requireAuth, async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const tenants = await storage.getTenants();
      res.json(tenants);
    } catch (error) {
      console.error("Error fetching tenants:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create tenant (admin only)
  app.post("/api/tenants", requireAuth, async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const { name, schemaName } = req.body;
      if (!name || !schemaName) {
        return res.status(400).json({ message: "Name and schema name are required" });
      }
      
      const tenant = await storage.createTenant(name, schemaName);
      res.status(201).json(tenant);
    } catch (error) {
      console.error("Error creating tenant:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Dataset routes
  // File upload
  app.post("/api/datasets/upload", requireAuth, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { name, description, analysisType } = req.body;
      
      if (!name) {
        return res.status(400).json({ message: "Dataset name is required" });
      }

      // Create dataset record
      const dataset = await storage.createDataset({
        name,
        description: description || null,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        filePath: req.file.path,
        uploadedById: req.user.id,
        tenantId: req.user.tenantId
      });

      // Log activity
      await storage.logActivity({
        action: "dataset_uploaded",
        description: `Uploaded dataset: ${name}`,
        entityType: "dataset",
        entityId: dataset.id,
        tenantId: req.user.tenantId,
        userId: req.user.id
      });

      // If analysis type is provided, start processing
      if (analysisType) {
        // Start processing in the background
        processData({
          source: "upload",
          datasetId: dataset.id,
          analysisType,
          tenantId: req.user.tenantId,
          initiatedById: req.user.id
        }).catch(error => {
          console.error("Error processing dataset:", error);
        });
      }

      res.status(201).json(dataset);
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get datasets
  app.get("/api/datasets", requireAuth, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const datasets = await storage.getDatasets(req.user.tenantId, limit);
      res.json(datasets);
    } catch (error) {
      console.error("Error fetching datasets:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get single dataset
  app.get("/api/datasets/:id", requireAuth, async (req, res) => {
    try {
      const datasetId = parseInt(req.params.id, 10);
      if (isNaN(datasetId)) {
        return res.status(400).json({ message: "Invalid dataset ID" });
      }
      
      const dataset = await storage.getDataset(datasetId, req.user.tenantId);
      if (!dataset) {
        return res.status(404).json({ message: "Dataset not found" });
      }
      
      res.json(dataset);
    } catch (error) {
      console.error("Error fetching dataset:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Webhook routes
  app.post("/api/webhooks", requireAuth, createWebhook);
  app.get("/api/webhooks", requireAuth, getWebhooks);
  app.get("/api/webhooks/:id", requireAuth, getWebhook);
  
  // Public webhook endpoint for receiving data
  app.post("/api/webhook-receiver/:id", handleWebhookRequest);

  // Analysis routes
  // Start analysis on existing dataset
  app.post("/api/analyses", requireAuth, async (req, res) => {
    try {
      const { datasetId, analysisType } = req.body;
      
      if (!datasetId || !analysisType) {
        return res.status(400).json({ message: "Dataset ID and analysis type are required" });
      }

      // Verify dataset exists and belongs to user's tenant
      const dataset = await storage.getDataset(datasetId, req.user.tenantId);
      if (!dataset) {
        return res.status(404).json({ message: "Dataset not found" });
      }

      // Start processing (this would be queued in production)
      const analysis = await processData({
        source: "upload",
        datasetId,
        analysisType,
        tenantId: req.user.tenantId,
        initiatedById: req.user.id
      });

      res.status(201).json(analysis);
    } catch (error) {
      console.error("Error starting analysis:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get analyses
  app.get("/api/analyses", requireAuth, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const analyses = await storage.getAnalyses(req.user.tenantId, limit);
      res.json(analyses);
    } catch (error) {
      console.error("Error fetching analyses:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get single analysis
  app.get("/api/analyses/:id", requireAuth, async (req, res) => {
    try {
      const analysisId = parseInt(req.params.id, 10);
      if (isNaN(analysisId)) {
        return res.status(400).json({ message: "Invalid analysis ID" });
      }
      
      const analysis = await storage.getAnalysis(analysisId, req.user.tenantId);
      if (!analysis) {
        return res.status(404).json({ message: "Analysis not found" });
      }
      
      // If analysis is complete and has results, fetch and return them
      if (analysis.status === "completed" && analysis.resultsPath) {
        try {
          const resultsData = await fs.readFile(analysis.resultsPath, "utf-8");
          analysis.results = JSON.parse(resultsData);
        } catch (error) {
          console.error("Error reading results file:", error);
          analysis.results = { error: "Could not read results file" };
        }
      }
      
      res.json(analysis);
    } catch (error) {
      console.error("Error fetching analysis:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Activities routes
  app.get("/api/activities", requireAuth, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const activities = await storage.getActivities(req.user.tenantId, limit);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching activities:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // User management routes
  app.get("/api/users", requireAuth, async (req, res) => {
    try {
      if (req.user.role !== "admin" && req.user.role !== "manager") {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const users = await storage.getUsers(req.user.tenantId);
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
