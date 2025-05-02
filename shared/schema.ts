import { pgTable, text, serial, integer, boolean, timestamp, jsonb, pgSchema } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// ---------- Users and Auth ----------

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("user"),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ one }) => ({
  tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }),
}));

export const insertUserSchema = createInsertSchema(users, {
  username: (schema) => schema.min(3, "Username must be at least 3 characters"),
  password: (schema) => schema.min(8, "Password must be at least 8 characters"),
  email: (schema) => schema.email("Must provide a valid email"),
  fullName: (schema) => schema.min(1, "Full name is required"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ---------- Tenants ----------

export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  schemaName: text("schema_name").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  datasets: many(datasets),
  webhooks: many(webhooks),
}));

export const insertTenantSchema = createInsertSchema(tenants, {
  name: (schema) => schema.min(2, "Name must be at least 2 characters"),
  schemaName: (schema) => schema.min(2, "Schema name must be at least 2 characters"),
});

export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;

// ---------- Datasets ----------

export const datasets = pgTable("datasets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  fileType: text("file_type").notNull(),
  filePath: text("file_path").notNull(),
  uploadedById: integer("uploaded_by_id").references(() => users.id).notNull(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const datasetsRelations = relations(datasets, ({ one, many }) => ({
  tenant: one(tenants, { fields: [datasets.tenantId], references: [tenants.id] }),
  uploadedBy: one(users, { fields: [datasets.uploadedById], references: [users.id] }),
  analyses: many(analyses),
}));

export const insertDatasetSchema = createInsertSchema(datasets, {
  name: (schema) => schema.min(1, "Name is required"),
  fileName: (schema) => schema.min(1, "Filename is required"),
  fileType: (schema) => schema.min(1, "File type is required"),
});

export type InsertDataset = z.infer<typeof insertDatasetSchema>;
export type Dataset = typeof datasets.$inferSelect;

// ---------- Webhooks ----------

export const webhooks = pgTable("webhooks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  endpoint: text("endpoint").notNull(),
  secret: text("secret"),
  isActive: boolean("is_active").notNull().default(true),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  createdById: integer("created_by_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const webhooksRelations = relations(webhooks, ({ one, many }) => ({
  tenant: one(tenants, { fields: [webhooks.tenantId], references: [tenants.id] }),
  createdBy: one(users, { fields: [webhooks.createdById], references: [users.id] }),
  dataIncoming: many(webhookData),
}));

export const insertWebhookSchema = createInsertSchema(webhooks, {
  name: (schema) => schema.min(1, "Name is required"),
  endpoint: (schema) => schema.url("Must be a valid URL"),
});

export type InsertWebhook = z.infer<typeof insertWebhookSchema>;
export type Webhook = typeof webhooks.$inferSelect;

export const webhookData = pgTable("webhook_data", {
  id: serial("id").primaryKey(),
  webhookId: integer("webhook_id").references(() => webhooks.id).notNull(),
  payload: jsonb("payload").notNull(),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const webhookDataRelations = relations(webhookData, ({ one, many }) => ({
  webhook: one(webhooks, { fields: [webhookData.webhookId], references: [webhooks.id] }),
  analyses: many(analyses),
}));

// ---------- Analyses ----------

export const analyses = pgTable("analyses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  analysisType: text("analysis_type").notNull(), // bias_analysis, pii_detection, etc.
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  datasetId: integer("dataset_id").references(() => datasets.id),
  webhookDataId: integer("webhook_data_id").references(() => webhookData.id),
  resultsPath: text("results_path"),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  initiatedById: integer("initiated_by_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const analysesRelations = relations(analyses, ({ one }) => ({
  tenant: one(tenants, { fields: [analyses.tenantId], references: [tenants.id] }),
  initiatedBy: one(users, { fields: [analyses.initiatedById], references: [users.id] }),
  dataset: one(datasets, { fields: [analyses.datasetId], references: [datasets.id] }),
  webhookData: one(webhookData, { fields: [analyses.webhookDataId], references: [webhookData.id] }),
}));

export const insertAnalysisSchema = createInsertSchema(analyses, {
  name: (schema) => schema.min(1, "Name is required"),
  analysisType: (schema) => schema.min(1, "Analysis type is required"),
});

export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Analysis = typeof analyses.$inferSelect;

// ---------- Activities ----------

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(),
  description: text("description").notNull(),
  entityType: text("entity_type").notNull(), // dataset, webhook, analysis, etc.
  entityId: integer("entity_id").notNull(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const activitiesRelations = relations(activities, ({ one }) => ({
  tenant: one(tenants, { fields: [activities.tenantId], references: [tenants.id] }),
  user: one(users, { fields: [activities.userId], references: [users.id] }),
}));

export const insertActivitySchema = createInsertSchema(activities);

export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;
