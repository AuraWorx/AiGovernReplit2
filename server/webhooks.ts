import { Request, Response } from "express";
import { storage } from "./storage";
import { processData } from "./processors";
import crypto from "crypto";

// Validate webhook signature if secret exists
function validateSignature(
  signature: string,
  secret: string,
  payload: string
): boolean {
  if (!secret) return true; // Skip validation if no secret is set

  const hmac = crypto.createHmac("sha256", secret);
  const calculatedSignature = hmac.update(payload).digest("hex");
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(calculatedSignature)
  );
}

// Handle webhook data receipt
export async function handleWebhookRequest(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const webhookId = parseInt(id, 10);
    
    if (isNaN(webhookId)) {
      return res.status(400).json({ error: "Invalid webhook ID" });
    }

    // Get webhook details
    const webhook = await storage.getWebhook(webhookId, req.user?.tenantId || 0);
    
    if (!webhook) {
      return res.status(404).json({ error: "Webhook not found" });
    }

    if (!webhook.isActive) {
      return res.status(403).json({ error: "Webhook is inactive" });
    }

    // Check signature if secret exists
    if (webhook.secret) {
      const signature = req.headers["x-webhook-signature"] as string;
      const payload = JSON.stringify(req.body);
      
      if (!signature || !validateSignature(signature, webhook.secret, payload)) {
        return res.status(401).json({ error: "Invalid webhook signature" });
      }
    }

    // Store webhook data
    const webhookData = await storage.storeWebhookData(webhookId, req.body);

    // Log activity
    await storage.logActivity({
      action: "webhook_data_received",
      description: `Received data from webhook: ${webhook.name}`,
      entityType: "webhook_data",
      entityId: webhookData.id,
      tenantId: webhook.tenantId,
      userId: webhook.createdById // Use webhook creator as the actor
    });

    // Queue data processing if needed
    // This would typically be handled by a task queue in production
    processData({
      source: "webhook",
      webhookDataId: webhookData.id,
      tenantId: webhook.tenantId,
      initiatedById: webhook.createdById
    }).catch(error => {
      console.error("Error processing webhook data:", error);
    });

    res.status(200).json({ message: "Webhook data received", id: webhookData.id });
  } catch (error) {
    console.error("Webhook handler error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Create a new webhook
export async function createWebhook(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { name, endpoint, secret } = req.body;
    
    if (!name || !endpoint) {
      return res.status(400).json({ error: "Name and endpoint are required" });
    }

    const webhook = await storage.createWebhook({
      name,
      endpoint,
      secret: secret || null,
      tenantId: req.user.tenantId,
      createdById: req.user.id
    });

    // Log activity
    await storage.logActivity({
      action: "webhook_created",
      description: `Created webhook: ${name}`,
      entityType: "webhook",
      entityId: webhook.id,
      tenantId: req.user.tenantId,
      userId: req.user.id
    });

    res.status(201).json(webhook);
  } catch (error) {
    console.error("Create webhook error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Get webhook list
export async function getWebhooks(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const webhooks = await storage.getWebhooks(req.user.tenantId);
    res.status(200).json(webhooks);
  } catch (error) {
    console.error("Get webhooks error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Get a single webhook
export async function getWebhook(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;
    const webhookId = parseInt(id, 10);
    
    if (isNaN(webhookId)) {
      return res.status(400).json({ error: "Invalid webhook ID" });
    }

    const webhook = await storage.getWebhook(webhookId, req.user.tenantId);
    
    if (!webhook) {
      return res.status(404).json({ error: "Webhook not found" });
    }

    res.status(200).json(webhook);
  } catch (error) {
    console.error("Get webhook error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
