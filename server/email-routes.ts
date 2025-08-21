import type { Express } from "express";
import { prisma } from "../lib/prisma";
import { buildAuthUrl, exchangeCodeForTokens } from "../utils/oauth";
import { enqueueSimpleJob, JobType } from "../lib/simple-queue";

export function registerEmailRoutes(app: Express) {
  // GET /api/email/authorize?provider=gmail|outlook
  app.get("/api/email/authorize", async (req, res) => {
    try {
      const { provider } = req.query;
      
      if (!provider || (provider !== 'gmail' && provider !== 'outlook')) {
        return res.status(400).json({ error: 'Invalid or missing provider. Must be gmail or outlook' });
      }
      
      const state = `user_${Date.now()}`; // In real app, would use actual user ID
      const authUrl = buildAuthUrl(provider as 'gmail' | 'outlook', state);
      
      console.log(`Generated OAuth URL for ${provider}:`, authUrl);
      
      // Return the URL for testing, or redirect in real implementation
      res.json({ authUrl, provider, state });
    } catch (error) {
      console.error('Error generating OAuth URL:', error);
      res.status(500).json({ error: 'Failed to generate authorization URL' });
    }
  });

  // GET /api/email/callback?provider=gmail|outlook
  app.get("/api/email/callback", async (req, res) => {
    try {
      const { provider, code, state, error } = req.query;
      
      if (error) {
        console.error('OAuth error:', error);
        return res.status(400).json({ error: 'OAuth authorization failed' });
      }
      
      if (!provider || !code) {
        return res.status(400).json({ error: 'Missing provider or authorization code' });
      }
      
      if (provider !== 'gmail' && provider !== 'outlook') {
        return res.status(400).json({ error: 'Invalid provider' });
      }
      
      console.log(`Processing OAuth callback for ${provider} with code:`, code);
      
      // Exchange code for tokens
      const tokens = await exchangeCodeForTokens(provider as 'gmail' | 'outlook', code as string);
      
      // Create test user if doesn't exist
      const testUserId = 'test-user-id';
      await prisma.user.upsert({
        where: { id: testUserId },
        update: {},
        create: {
          id: testUserId,
          email: `test@${provider}.com`,
          name: 'Test User'
        }
      });
      
      // Store email integration
      const integration = await prisma.emailIntegration.create({
        data: {
          userId: testUserId,
          provider: provider as string,
          email: `test@${provider}.com`,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiry: new Date(Date.now() + (tokens.expires_in * 1000))
        }
      });
      
      console.log('Created email integration:', integration.id);
      
      res.json({ 
        success: true, 
        integrationId: integration.id,
        provider,
        message: 'Email integration created successfully'
      });
    } catch (error) {
      console.error('Error processing OAuth callback:', error);
      res.status(500).json({ error: 'Failed to process authorization callback' });
    }
  });

  // POST /api/email/webhook
  app.post("/api/email/webhook", async (req, res) => {
    try {
      const payload = req.body;
      console.log('Received webhook payload:', payload);
      
      // Extract message info from webhook payload (format varies by provider)
      const messageData = {
        messageId: payload.messageId || `msg_${Date.now()}`,
        emailIntegrationId: payload.integrationId || 'test-integration',
        subject: payload.subject || 'Test Email',
        sender: payload.sender || 'test@example.com',
        attachments: payload.attachments || [],
        body: payload.body || 'Test email body'
      };
      
      // Enqueue email processing job
      const job = await enqueueSimpleJob(JobType.EMAIL_PROCESS_MESSAGE, messageData);
      
      console.log(`Enqueued email processing job ${job.id} for message: ${messageData.messageId}`);
      
      res.json({ 
        success: true, 
        jobId: job.id,
        messageId: messageData.messageId,
        message: 'Webhook received and job enqueued'
      });
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).json({ error: 'Failed to process webhook' });
    }
  });

  // POST /api/email/push
  app.post("/api/email/push", async (req, res) => {
    try {
      const notification = req.body;
      console.log('Received push notification:', notification);
      
      // Extract integration info and enqueue fetch job
      const integrationId = notification.integrationId || 'test-integration';
      
      const job = await enqueueSimpleJob(JobType.EMAIL_SYNC_POLL, {
        emailIntegrationId: integrationId,
        lastSyncedMessageId: notification.lastMessageId
      });
      
      console.log(`Enqueued sync poll job ${job.id} for integration: ${integrationId}`);
      
      res.json({ 
        success: true, 
        jobId: job.id,
        message: 'Push notification received and sync job enqueued'
      });
    } catch (error) {
      console.error('Error processing push notification:', error);
      res.status(500).json({ error: 'Failed to process push notification' });
    }
  });

  // GET /api/email/forwarding-address
  app.get("/api/email/forwarding-address", async (req, res) => {
    try {
      // Generate or retrieve forwarding address
      const domain = process.env.FORWARDING_DOMAIN || 'receipts.example.com';
      const address = `receipts+${Date.now()}@${domain}`;
      
      // Store forwarding address
      await prisma.forwardingAddress.create({
        data: {
          address,
          userId: 'test-user-id' // In real app, would use authenticated user
        }
      });
      
      console.log('Generated forwarding address:', address);
      
      res.json({ 
        forwardingAddress: address,
        instructions: `Forward your receipt emails to: ${address}`
      });
    } catch (error) {
      console.error('Error generating forwarding address:', error);
      res.status(500).json({ error: 'Failed to generate forwarding address' });
    }
  });

  // GET /api/email/pending
  app.get("/api/email/pending", async (req, res) => {
    try {
      const pendingReceipts = await prisma.pendingReceipt.findMany({
        where: {
          status: 'pending'
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      console.log(`Found ${pendingReceipts.length} pending receipts`);
      
      res.json({ 
        pendingReceipts,
        count: pendingReceipts.length
      });
    } catch (error) {
      console.error('Error fetching pending receipts:', error);
      res.status(500).json({ error: 'Failed to fetch pending receipts' });
    }
  });

  // POST /api/email/pending/:id/accept
  app.post("/api/email/pending/:id/accept", async (req, res) => {
    try {
      const { id } = req.params;
      
      const pendingReceipt = await prisma.pendingReceipt.findUnique({
        where: { id }
      });
      
      if (!pendingReceipt) {
        return res.status(404).json({ error: 'Pending receipt not found' });
      }
      
      // Create receipt from pending data
      const extractedData = pendingReceipt.extractedData as any;
      const receipt = await prisma.receipt.create({
        data: {
          userId: pendingReceipt.userId,
          merchantName: extractedData.merchantName || 'Unknown Merchant',
          total: extractedData.total || '0.00',
          date: new Date(extractedData.date || Date.now()),
          receiptNumber: extractedData.receiptNumber,
          category: extractedData.category || 'Other',
          paymentMethod: extractedData.paymentMethod,
          location: extractedData.location,
          items: extractedData.items,
          metadata: { source: 'email_import', confidence: pendingReceipt.confidence }
        }
      });
      
      // Update pending receipt status
      await prisma.pendingReceipt.update({
        where: { id },
        data: {
          status: 'accepted',
          reviewedAt: new Date()
        }
      });
      
      console.log(`Accepted pending receipt ${id}, created receipt ${receipt.id}`);
      
      res.json({ 
        success: true, 
        receiptId: receipt.id,
        message: 'Receipt accepted and created'
      });
    } catch (error) {
      console.error('Error accepting pending receipt:', error);
      res.status(500).json({ error: 'Failed to accept pending receipt' });
    }
  });

  // POST /api/email/pending/:id/reject
  app.post("/api/email/pending/:id/reject", async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      const pendingReceipt = await prisma.pendingReceipt.findUnique({
        where: { id }
      });
      
      if (!pendingReceipt) {
        return res.status(404).json({ error: 'Pending receipt not found' });
      }
      
      // Update pending receipt status
      await prisma.pendingReceipt.update({
        where: { id },
        data: {
          status: 'rejected',
          reviewedAt: new Date()
        }
      });
      
      console.log(`Rejected pending receipt ${id}. Reason:`, reason);
      
      res.json({ 
        success: true, 
        message: 'Receipt rejected'
      });
    } catch (error) {
      console.error('Error rejecting pending receipt:', error);
      res.status(500).json({ error: 'Failed to reject pending receipt' });
    }
  });

  // GET /api/email/forwarding-address
  app.get("/api/email/forwarding-address", async (req, res) => {
    try {
      // Generate or retrieve forwarding address for this user/app
      const domain = process.env.FORWARDING_DOMAIN || 'receipts.example.com';
      const forwardingAddress = `import-${Date.now()}@${domain}`;
      
      res.json({
        forwardingAddress,
        instructions: `Forward your receipt emails to this address. We'll automatically process them and add receipts to your account.`,
        setupGuide: `Set up email forwarding rules in your email client to automatically forward receipts from merchants to this address.`
      });
    } catch (error) {
      console.error("Error generating forwarding address:", error);
      res.status(500).json({ error: "Failed to generate forwarding address" });
    }
  });

  // GET /api/email/integrations
  app.get("/api/email/integrations", async (req, res) => {
    try {
      const integrations = await prisma.emailIntegration.findMany({
        select: {
          id: true,
          provider: true,
          email: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        }
      });
      
      res.json({
        gmail: integrations.find(i => i.provider === 'gmail'),
        outlook: integrations.find(i => i.provider === 'outlook'),
        lastSync: integrations[0]?.updatedAt
      });
    } catch (error) {
      console.error("Error fetching integrations:", error);
      res.status(500).json({ error: "Failed to fetch integrations" });
    }
  });

  // POST /api/email/disconnect
  app.post("/api/email/disconnect", async (req, res) => {
    try {
      const { integrationId } = req.body;
      
      if (!integrationId) {
        return res.status(400).json({ error: "Integration ID required" });
      }
      
      await prisma.emailIntegration.update({
        where: { id: integrationId },
        data: { 
          isActive: false,
          accessToken: null,
          refreshToken: null
        }
      });
      
      res.json({ success: true, message: "Integration disconnected" });
    } catch (error) {
      console.error("Error disconnecting integration:", error);
      res.status(500).json({ error: "Failed to disconnect integration" });
    }
  });

  // POST /api/email/sync
  app.post("/api/email/sync", async (req, res) => {
    try {
      const { integrationId } = req.body;
      
      if (!integrationId) {
        return res.status(400).json({ error: "Integration ID required" });
      }
      
      const job = await enqueueSimpleJob(JobType.EMAIL_SYNC_POLL, {
        integrationId
      });
      
      res.json({ success: true, jobId: job.id, message: "Sync initiated" });
    } catch (error) {
      console.error("Error starting sync:", error);
      res.status(500).json({ error: "Failed to start sync" });
    }
  });

  // POST /api/email/backfill?days=90
  app.post("/api/email/backfill", async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      
      if (days > 365) {
        return res.status(400).json({ error: "Maximum backfill period is 365 days" });
      }
      
      const integrations = await prisma.emailIntegration.findMany({
        where: { isActive: true }
      });
      
      if (integrations.length === 0) {
        return res.status(400).json({ error: "No active email integrations found" });
      }
      
      const jobs = [];
      for (const integration of integrations) {
        const job = await enqueueSimpleJob(JobType.EMAIL_BACKFILL, {
          integrationId: integration.id,
          days,
          startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
        });
        jobs.push(job.id);
      }
      
      res.json({ 
        success: true, 
        jobIds: jobs,
        integrations: integrations.length,
        days,
        message: `Backfill initiated for ${integrations.length} integrations` 
      });
    } catch (error) {
      console.error("Error starting backfill:", error);
      res.status(500).json({ error: "Failed to start backfill" });
    }
  });
}