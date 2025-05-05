import { db } from "@db"; // Assumes db/index.ts exports the configured drizzle instance
import { users, tenants, datasets, webhooks, analyses, activities, webhookData } from "@shared/schema";
import type { InsertUser, User, Dataset, Webhook, Analysis, Activity, WebhookData } from "@shared/schema"; // Import types
import { eq, desc, and } from "drizzle-orm";
import { log } from "./utils/logger";

// Interface defining storage operations
export interface IStorage {
  // User operations
  createUser(user: Omit<InsertUser, "id" | "updatedAt" | "createdAt">): Promise<User>;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsers(tenantId: number): Promise<User[]>;

  // Tenant operations
  createTenant(name: string, schemaName: string): Promise<Tenant>;
  getTenant(id: number): Promise<Tenant | undefined>;
  getTenants(): Promise<Tenant[]>;

  // Dataset operations
  createDataset(dataset: Omit<InsertDataset, "id" | "createdAt" | "updatedAt">): Promise<Dataset>;
  getDataset(id: number, tenantId: number): Promise<Dataset | undefined>;
  getDatasets(tenantId: number, limit?: number): Promise<Dataset[]>;

  // Webhook operations
  createWebhook(webhook: Omit<Webhook, "id" | "createdAt" | "updatedAt" | "isActive">): Promise<Webhook>;
  getWebhook(id: number, tenantId: number): Promise<Webhook | undefined>;
  getWebhooks(tenantId: number): Promise<Webhook[]>;
  storeWebhookData(webhookId: number, payload: any): Promise<WebhookData>;
  getWebhookDataById(id: number, tenantId: number): Promise<(WebhookData & { webhook?: Webhook }) | undefined>; // Include webhook relation type

  // Analysis operations
  createAnalysis(analysis: Omit<Analysis, "id" | "createdAt" | "completedAt" | "status" | "resultsPath">): Promise<Analysis>;
  getAnalysis(id: number, tenantId: number): Promise<Analysis | undefined>;
  getAnalyses(tenantId: number, limit?: number): Promise<Analysis[]>;
  updateAnalysisStatus(id: number, status: string, resultsPath?: string | null): Promise<Analysis | undefined>;

  // Activity operations
  logActivity(activity: Omit<Activity, "id" | "createdAt">): Promise<Activity>;
  getActivities(tenantId: number, limit?: number): Promise<Activity[]>;
}

// Database implementation of the storage interface
export class DatabaseStorage implements IStorage {

  constructor() {
     log("DatabaseStorage initialized", "storage");
  }

  // --- User operations ---
  async createUser(userData: Omit<InsertUser, "id" | "updatedAt" | "createdAt">): Promise<User> {
    log(`Creating user: ${userData.username}`, "storage-user");
    const [user] = await db.insert(users).values(userData).returning();
    if (!user) throw new Error("Failed to create user.");
    return user;
  }

  async getUser(id: number): Promise<User | undefined> {
    log(`Getting user by ID: ${id}`, "storage-user");
    return await db.query.users.findFirst({
      where: eq(users.id, id)
    });
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    log(`Getting user by username: ${username}`, "storage-user");
    return await db.query.users.findFirst({
      where: eq(users.username, username)
    });
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    log(`Getting user by email: ${email}`, "storage-user");
    return await db.query.users.findFirst({
      where: eq(users.email, email)
    });
  }

  async getUsers(tenantId: number): Promise<User[]> {
    log(`Getting users for tenant ID: ${tenantId}`, "storage-user");
    return await db.query.users.findMany({
      where: eq(users.tenantId, tenantId),
       columns: { password: false } // Exclude password from list results
    });
  }

  // --- Tenant operations ---
  async createTenant(name: string, schemaName: string): Promise<Tenant> {
    log(`Creating tenant: ${name}`, "storage-tenant");
    const [tenant] = await db.insert(tenants).values({
      name,
      schemaName,
      isActive: true, // Default to active
    }).returning();
     if (!tenant) throw new Error("Failed to create tenant.");
    return tenant;
  }

  async getTenant(id: number): Promise<Tenant | undefined> {
    log(`Getting tenant by ID: ${id}`, "storage-tenant");
    return await db.query.tenants.findFirst({
      where: eq(tenants.id, id)
    });
  }

  async getTenants(): Promise<Tenant[]> {
    log(`Getting all active tenants`, "storage-tenant");
    return await db.query.tenants.findMany({
      where: eq(tenants.isActive, true)
    });
  }

  // --- Dataset operations ---
  async createDataset(datasetData: Omit<InsertDataset, "id" | "createdAt" | "updatedAt">): Promise<Dataset> {
     log(`Creating dataset: ${datasetData.name}`, "storage-dataset");
     const [newDataset] = await db.insert(datasets).values(datasetData).returning();
     if (!newDataset) throw new Error("Failed to create dataset.");
     return newDataset;
  }

  async getDataset(id: number, tenantId: number): Promise<Dataset | undefined> {
    log(`Getting dataset ID: ${id} for tenant ID: ${tenantId}`, "storage-dataset");
    return await db.query.datasets.findFirst({
      where: and(
        eq(datasets.id, id),
        eq(datasets.tenantId, tenantId)
      ),
      with: {
        uploadedBy: { columns: { id: true, username: true, fullName: true } } // Select specific user fields
      }
    });
  }

  async getDatasets(tenantId: number, limit?: number): Promise<Dataset[]> {
     log(`Getting datasets for tenant ID: ${tenantId} (limit: ${limit || 'none'})`, "storage-dataset");
     return await db.query.datasets.findMany({
       where: eq(datasets.tenantId, tenantId),
       orderBy: desc(datasets.createdAt),
       with: {
         uploadedBy: { columns: { id: true, username: true, fullName: true } }
       },
       limit: limit
     });
  }

  // --- Webhook operations ---
  async createWebhook(webhookDataInput: Omit<Webhook, "id" | "createdAt" | "updatedAt" | "isActive">): Promise<Webhook> {
      log(`Creating webhook: ${webhookDataInput.name}`, "storage-webhook");
      const [newWebhook] = await db.insert(webhooks).values({
          ...webhookDataInput,
          isActive: true // Default to active
      }).returning();
      if (!newWebhook) throw new Error("Failed to create webhook.");
      return newWebhook;
  }

  async getWebhook(id: number, tenantId: number): Promise<Webhook | undefined> {
    log(`Getting webhook ID: ${id} for tenant ID: ${tenantId}`, "storage-webhook");
    return await db.query.webhooks.findFirst({
      where: and(
        eq(webhooks.id, id),
        eq(webhooks.tenantId, tenantId)
      ),
      with: {
        createdBy: { columns: { id: true, username: true, fullName: true } }
      }
    });
  }

  async getWebhooks(tenantId: number): Promise<Webhook[]> {
    log(`Getting active webhooks for tenant ID: ${tenantId}`, "storage-webhook");
    return await db.query.webhooks.findMany({
      where: and(
        eq(webhooks.tenantId, tenantId),
        eq(webhooks.isActive, true)
      ),
      with: {
         createdBy: { columns: { id: true, username: true, fullName: true } }
      }
    });
  }

  async storeWebhookData(webhookId: number, payload: any): Promise<WebhookData> {
     log(`Storing data for webhook ID: ${webhookId}`, "storage-webhook-data");
     const [data] = await db.insert(webhookData).values({
       webhookId,
       payload // Drizzle handles JSON stringification
     }).returning();
      if (!data) throw new Error("Failed to store webhook data.");
     return data;
  }

  async getWebhookDataById(id: number, tenantId: number): Promise<(WebhookData & { webhook?: Webhook }) | undefined> {
      log(`Getting webhook data ID: ${id} for tenant ID: ${tenantId}`, "storage-webhook-data");
      // Drizzle doesn't easily support filtering based on a relation's property directly in findFirst.
      // Fetch first, then check tenantId.
      const data = await db.query.webhookData.findFirst({
          where: eq(webhookData.id, id),
          with: {
              webhook: true // Include the related webhook
          }
      });

      // Verify the webhook data belongs to the correct tenant
      if (data?.webhook?.tenantId !== tenantId) {
          log(`Webhook data ${id} found, but does not belong to tenant ${tenantId}`, "storage-webhook-data");
          return undefined; // Not found for this tenant
      }

      return data;
  }


  // --- Analysis operations ---
  async createAnalysis(analysisData: Omit<Analysis, "id" | "createdAt" | "completedAt" | "status" | "resultsPath">): Promise<Analysis> {
    log(`Creating analysis record: ${analysisData.name}`, "storage-analysis");
    const [newAnalysis] = await db.insert(analyses).values({
        ...analysisData,
        status: 'pending' // Initial status
    }).returning();
    if (!newAnalysis) throw new Error("Failed to create analysis record.");
    return newAnalysis;
  }

  async getAnalysis(id: number, tenantId: number): Promise<Analysis | undefined> {
    log(`Getting analysis ID: ${id} for tenant ID: ${tenantId}`, "storage-analysis");
    return await db.query.analyses.findFirst({
      where: and(
        eq(analyses.id, id),
        eq(analyses.tenantId, tenantId)
      ),
      with: {
        initiatedBy: { columns: { id: true, username: true, fullName: true } },
        dataset: true, // Include full dataset object if needed
        webhookData: true // Include full webhook data object if needed
      }
    });
  }

  async getAnalyses(tenantId: number, limit?: number): Promise<Analysis[]> {
     log(`Getting analyses for tenant ID: ${tenantId} (limit: ${limit || 'none'})`, "storage-analysis");
     return await db.query.analyses.findMany({
       where: eq(analyses.tenantId, tenantId),
       orderBy: desc(analyses.createdAt),
       with: {
         initiatedBy: { columns: { id: true, username: true, fullName: true } },
         dataset: { columns: { id: true, name: true, fileName: true } }, // Select specific dataset fields
         webhookData: { columns: { id: true, webhookId: true } } // Select specific webhook data fields
       },
       limit: limit
     });
  }

  async updateAnalysisStatus(id: number, status: string, resultsPath?: string | null): Promise<Analysis | undefined> {
      log(`Updating analysis ID: ${id} to status: ${status} ${resultsPath ? `(Results: ${resultsPath})` : ''}`, "storage-analysis");
      const updateData: Partial<Analysis> = { status }; // Use Partial type

      if (status === "completed") {
          updateData.resultsPath = resultsPath || null; // Store path or null
          updateData.completedAt = new Date();
      } else if (status === "failed") {
          // Optionally clear results path on failure or set a specific error indicator
          updateData.completedAt = new Date(); // Mark completion time even on failure
      }

      const [updatedAnalysis] = await db
          .update(analyses)
          .set(updateData)
          .where(eq(analyses.id, id))
          .returning();

      if (!updatedAnalysis) {
          log(`Analysis ID: ${id} not found during status update.`, "storage-analysis-warning");
      }
      return updatedAnalysis;
  }

  // --- Activity operations ---
  async logActivity(activityData: Omit<Activity, "id" | "createdAt">): Promise<Activity> {
     // Avoid logging excessively verbose descriptions if necessary
     const shortDesc = activityData.description.length > 200
         ? activityData.description.substring(0, 197) + '...'
         : activityData.description;
     log(`Logging activity: ${activityData.action} - ${shortDesc}`, "storage-activity");

     const [newActivity] = await db.insert(activities).values(activityData).returning();
     if (!newActivity) throw new Error("Failed to log activity.");
     return newActivity;
  }

  async getActivities(tenantId: number, limit: number = 50): Promise<Activity[]> { // Default limit
     log(`Getting activities for tenant ID: ${tenantId} (limit: ${limit})`, "storage-activity");
     return await db.query.activities.findMany({
       where: eq(activities.tenantId, tenantId),
       orderBy: desc(activities.createdAt),
       with: {
         user: { columns: { id: true, username: true, fullName: true } } // Select specific user fields
       },
       limit: limit
     });
  }
}

// Export a single instance of the storage class
export const storage = new DatabaseStorage();
