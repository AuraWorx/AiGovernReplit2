import { db } from "@db";
import { users, tenants, datasets, webhooks, analyses, activities, webhookData } from "@shared/schema";
import { InsertUser, User } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "@db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User operations
  createUser(user: Omit<InsertUser, "updatedAt" | "createdAt">): Promise<User>;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsers(tenantId: number): Promise<User[]>;
  
  // Tenant operations
  createTenant(name: string, schemaName: string): Promise<any>;
  getTenant(id: number): Promise<any>;
  getTenants(): Promise<any[]>;
  
  // Dataset operations
  createDataset(dataset: any): Promise<any>;
  getDataset(id: number, tenantId: number): Promise<any>;
  getDatasets(tenantId: number, limit?: number): Promise<any[]>;
  
  // Webhook operations
  createWebhook(webhook: any): Promise<any>;
  getWebhook(id: number, tenantId: number): Promise<any>;
  getWebhooks(tenantId: number): Promise<any[]>;
  storeWebhookData(webhookId: number, payload: any): Promise<any>;
  getWebhookDataById(id: number, tenantId: number): Promise<any>;
  
  // Analysis operations
  createAnalysis(analysis: any): Promise<any>;
  getAnalysis(id: number, tenantId: number): Promise<any>;
  getAnalyses(tenantId: number, limit?: number): Promise<any[]>;
  updateAnalysisStatus(id: number, status: string, resultsPath?: string): Promise<any>;
  
  // Activity operations
  logActivity(activity: any): Promise<any>;
  getActivities(tenantId: number, limit?: number): Promise<any[]>;
  
  // Session store
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      tableName: "session",
      createTableIfMissing: true
    });
  }

  // User operations
  async createUser(userData: Omit<InsertUser, "updatedAt" | "createdAt">): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async getUser(id: number): Promise<User | undefined> {
    return await db.query.users.findFirst({
      where: eq(users.id, id)
    });
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return await db.query.users.findFirst({
      where: eq(users.username, username)
    });
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return await db.query.users.findFirst({
      where: eq(users.email, email)
    });
  }

  async getUsers(tenantId: number): Promise<User[]> {
    return await db.query.users.findMany({
      where: eq(users.tenantId, tenantId)
    });
  }

  // Tenant operations
  async createTenant(name: string, schemaName: string): Promise<any> {
    const [tenant] = await db.insert(tenants).values({
      name,
      schemaName,
    }).returning();
    return tenant;
  }

  async getTenant(id: number): Promise<any> {
    return await db.query.tenants.findFirst({
      where: eq(tenants.id, id)
    });
  }

  async getTenants(): Promise<any[]> {
    return await db.query.tenants.findMany({
      where: eq(tenants.isActive, true)
    });
  }

  // Dataset operations
  async createDataset(dataset: any): Promise<any> {
    const [newDataset] = await db.insert(datasets).values(dataset).returning();
    return newDataset;
  }

  async getDataset(id: number, tenantId: number): Promise<any> {
    return await db.query.datasets.findFirst({
      where: and(
        eq(datasets.id, id),
        eq(datasets.tenantId, tenantId)
      ),
      with: {
        uploadedBy: true
      }
    });
  }

  async getDatasets(tenantId: number, limit?: number): Promise<any[]> {
    return await db.query.datasets.findMany({
      where: eq(datasets.tenantId, tenantId),
      orderBy: desc(datasets.createdAt),
      with: {
        uploadedBy: true
      },
      limit: limit
    });
  }

  // Webhook operations
  async createWebhook(webhook: any): Promise<any> {
    const [newWebhook] = await db.insert(webhooks).values(webhook).returning();
    return newWebhook;
  }

  async getWebhook(id: number, tenantId: number): Promise<any> {
    return await db.query.webhooks.findFirst({
      where: and(
        eq(webhooks.id, id),
        eq(webhooks.tenantId, tenantId)
      ),
      with: {
        createdBy: true
      }
    });
  }

  async getWebhooks(tenantId: number): Promise<any[]> {
    return await db.query.webhooks.findMany({
      where: and(
        eq(webhooks.tenantId, tenantId),
        eq(webhooks.isActive, true)
      ),
      with: {
        createdBy: true
      }
    });
  }

  async storeWebhookData(webhookId: number, payload: any): Promise<any> {
    const [data] = await db.insert(webhookData).values({
      webhookId,
      payload
    }).returning();
    return data;
  }

  async getWebhookDataById(id: number, tenantId: number): Promise<any> {
    // First find the webhook data
    const data = await db.query.webhookData.findFirst({
      where: eq(webhookData.id, id),
      with: {
        webhook: true
      }
    });
    
    // Then check if it belongs to the specified tenant
    if (data && data.webhook && data.webhook.tenantId === tenantId) {
      return data;
    }
    
    return null;
  }

  // Analysis operations
  async createAnalysis(analysis: any): Promise<any> {
    const [newAnalysis] = await db.insert(analyses).values(analysis).returning();
    return newAnalysis;
  }

  async getAnalysis(id: number, tenantId: number): Promise<any> {
    return await db.query.analyses.findFirst({
      where: and(
        eq(analyses.id, id),
        eq(analyses.tenantId, tenantId)
      ),
      with: {
        initiatedBy: true,
        dataset: true,
        webhookData: true
      }
    });
  }

  async getAnalyses(tenantId: number, limit?: number): Promise<any[]> {
    return await db.query.analyses.findMany({
      where: eq(analyses.tenantId, tenantId),
      orderBy: desc(analyses.createdAt),
      with: {
        initiatedBy: true,
        dataset: true,
        webhookData: true
      },
      limit: limit
    });
  }

  async updateAnalysisStatus(id: number, status: string, resultsPath?: string): Promise<any> {
    const updateData: any = { status };
    
    if (status === "completed" && resultsPath) {
      updateData.resultsPath = resultsPath;
      updateData.completedAt = new Date();
    }

    const [updatedAnalysis] = await db
      .update(analyses)
      .set(updateData)
      .where(eq(analyses.id, id))
      .returning();
    
    return updatedAnalysis;
  }

  // Activity operations
  async logActivity(activity: any): Promise<any> {
    const [newActivity] = await db.insert(activities).values(activity).returning();
    return newActivity;
  }

  async getActivities(tenantId: number, limit?: number): Promise<any[]> {
    return await db.query.activities.findMany({
      where: eq(activities.tenantId, tenantId),
      orderBy: desc(activities.createdAt),
      with: {
        user: true
      },
      ...(limit ? { limit } : {})
    });
  }
}

export const storage = new DatabaseStorage();
