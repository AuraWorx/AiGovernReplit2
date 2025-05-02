import { db } from "./index";
import * as schema from "@shared/schema";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function seed() {
  try {
    console.log("Starting database seed...");

    // Check if tenants exist
    const existingTenants = await db.query.tenants.findMany();
    
    if (existingTenants.length === 0) {
      console.log("Creating tenants...");
      
      // Create default tenants
      const tenants = await db.insert(schema.tenants).values([
        {
          name: "Demo Organization",
          schemaName: "demo_org",
          isActive: true
        },
        {
          name: "Acme Corporation",
          schemaName: "acme_corp",
          isActive: true
        }
      ]).returning();
      
      console.log(`Created ${tenants.length} tenants`);
      
      // Create users for each tenant
      for (const tenant of tenants) {
        console.log(`Creating users for tenant: ${tenant.name}`);
        
        // Create admin user
        await db.insert(schema.users).values({
          username: `admin_${tenant.schemaName}`,
          password: await hashPassword("password123"),
          email: `admin@${tenant.schemaName.replace('_', '')}.com`,
          fullName: "Admin User",
          role: "admin",
          tenantId: tenant.id
        });
        
        // Create regular user
        await db.insert(schema.users).values({
          username: `user_${tenant.schemaName}`,
          password: await hashPassword("password123"),
          email: `user@${tenant.schemaName.replace('_', '')}.com`,
          fullName: "Regular User",
          role: "user",
          tenantId: tenant.id
        });
      }
      
      console.log("Users created successfully");
      
      // Create sample webhook for first tenant
      const webhook = await db.insert(schema.webhooks).values({
        name: "Demo Webhook",
        endpoint: "https://example.com/webhook",
        secret: "webhook_secret",
        isActive: true,
        tenantId: tenants[0].id,
        createdById: 1 // Assuming the first user has ID 1
      }).returning();
      
      console.log("Sample webhook created");
      
      // Log sample activities
      const activities = [
        {
          action: "user_login",
          description: "User logged in",
          entityType: "user",
          entityId: 1,
          tenantId: tenants[0].id,
          userId: 1
        },
        {
          action: "webhook_created",
          description: "Created webhook: Demo Webhook",
          entityType: "webhook",
          entityId: webhook[0].id,
          tenantId: tenants[0].id,
          userId: 1
        }
      ];
      
      await db.insert(schema.activities).values(activities);
      
      console.log("Sample activities created");
    } else {
      console.log("Tenants already exist, skipping seed");
    }
    
    console.log("Seed completed successfully");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

seed();
