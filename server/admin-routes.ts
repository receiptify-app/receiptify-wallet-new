import { Router } from "express";
import type { Request, Response } from "express";
import { storage } from "./storage";
import { simpleQueue } from "../lib/simple-queue";

const router = Router();

// D) Admin endpoints

// GET /api/admin/email-integrations - Show all email integrations with status
router.get("/email-integrations", async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string || "test-user-id";
    
    // Get all integrations for the user
    const integrations = await storage.getEmailIntegrations(userId);
    
    // Enhanced integration info with sync status
    const integrationDetails = integrations.map(integration => ({
      id: integration.id,
      provider: integration.provider,
      email: integration.email,
      status: integration.status,
      isActive: integration.isActive,
      syncCursor: integration.syncCursor,
      lastSyncAt: integration.lastSyncAt,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
      // Add sync status info
      hasSyncCursor: !!integration.syncCursor,
      daysSinceLastSync: integration.lastSyncAt 
        ? Math.floor((Date.now() - new Date(integration.lastSyncAt).getTime()) / (1000 * 60 * 60 * 24))
        : null
    }));

    // Get pending receipts count
    const pendingReceipts = await storage.getPendingReceipts(userId);
    
    // Get queue status (simplified)
    const queueStats = {
      pending: simpleQueue.queue.length,
      processing: simpleQueue.processing.size,
    };

    res.json({
      userId,
      integrations: integrationDetails,
      summary: {
        totalIntegrations: integrations.length,
        activeIntegrations: integrations.filter(i => i.isActive).length,
        pendingReceipts: pendingReceipts.length,
        queueStats
      }
    });
  } catch (error) {
    console.error("Admin email integrations error:", error);
    res.status(500).json({ error: "Failed to get email integrations" });
  }
});

// POST /api/email/backfill - Trigger backfill for an integration
router.post("/backfill", async (req: Request, res: Response) => {
  try {
    const { integrationId, days = 90 } = req.body;
    
    if (!integrationId) {
      return res.status(400).json({ error: "integrationId required" });
    }

    const integration = await storage.getEmailIntegration(integrationId);
    if (!integration) {
      return res.status(404).json({ error: "Integration not found" });
    }

    // Enqueue backfill job
    await simpleQueue.enqueue("email_backfill", {
      integrationId,
      days: parseInt(days),
      timestamp: Date.now()
    });

    res.json({
      message: "Backfill job enqueued",
      integrationId,
      days,
      provider: integration.provider,
      email: integration.email
    });
  } catch (error) {
    console.error("Backfill error:", error);
    res.status(500).json({ error: "Backfill failed" });
  }
});

// GET /api/admin/pending-receipts - Show pending receipts
router.get("/pending-receipts", async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string || "test-user-id";
    const pendingReceipts = await storage.getPendingReceipts(userId);
    
    res.json({
      userId,
      pendingReceipts,
      count: pendingReceipts.length
    });
  } catch (error) {
    console.error("Admin pending receipts error:", error);
    res.status(500).json({ error: "Failed to get pending receipts" });
  }
});

// GET /api/admin/queue-status - Show job queue status
router.get("/queue-status", async (req: Request, res: Response) => {
  try {
    const queueStatus = {
      pending: simpleQueue.queue.length,
      processing: simpleQueue.processing.size,
      recentJobs: simpleQueue.queue.slice(-10).map(job => ({
        type: job.type,
        data: job.data,
        createdAt: job.createdAt
      }))
    };

    res.json(queueStatus);
  } catch (error) {
    console.error("Queue status error:", error);
    res.status(500).json({ error: "Failed to get queue status" });
  }
});

// POST /api/admin/test-integration - Test an integration
router.post("/test-integration", async (req: Request, res: Response) => {
  try {
    const { integrationId } = req.body;
    
    if (!integrationId) {
      return res.status(400).json({ error: "integrationId required" });
    }

    const integration = await storage.getEmailIntegration(integrationId);
    if (!integration) {
      return res.status(404).json({ error: "Integration not found" });
    }

    // Enqueue a test poll job
    await simpleQueue.enqueue("email_process.test", {
      integrationId,
      testRun: true,
      timestamp: Date.now()
    });

    res.json({
      message: "Test job enqueued for integration",
      integrationId,
      provider: integration.provider,
      email: integration.email
    });
  } catch (error) {
    console.error("Test integration error:", error);
    res.status(500).json({ error: "Test failed" });
  }
});

export { router as adminRouter };