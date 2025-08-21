import { Router } from "express";
import type { Request, Response } from "express";
import crypto from "crypto";
import { storage } from "./storage";
import { simpleQueue } from "../lib/simple-queue";

const router = Router();

// C) Forwarding Inbox Implementation

// GET /api/email/forwarding-address - Get unique forwarding address for current user
router.get("/forwarding-address", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || "test-user-id"; // Get from auth
    
    // Check if user already has a forwarding address
    let forwardingAddress = await storage.getForwardingAddress(userId);
    
    if (!forwardingAddress) {
      // Create new forwarding address
      const shortToken = crypto.randomBytes(8).toString("hex");
      const domain = process.env.FORWARDING_DOMAIN || "receiptify.app";
      const address = `receipts+${userId}_${shortToken}@${domain}`;
      
      forwardingAddress = await storage.createForwardingAddress({
        userId,
        address,
        token: shortToken,
        isActive: true,
      });
    }

    res.json({
      forwardingAddress: forwardingAddress.address,
      instructions: [
        "Forward receipt emails to this address",
        "Emails will be automatically processed for receipts",
        "Set up email forwarding rules in Gmail/Outlook to forward purchase confirmation emails"
      ]
    });
  } catch (error) {
    console.error("Forwarding address error:", error);
    res.status(500).json({ error: "Failed to get forwarding address" });
  }
});

// POST /api/email/webhook - Accept inbound emails from SendGrid/Mailgun/Postmark
router.post("/webhook", async (req: Request, res: Response) => {
  try {
    const { to, from, subject, text, html, attachments } = req.body;
    
    console.log("Incoming email webhook:", {
      to,
      from,
      subject: subject || "No Subject",
      hasAttachments: attachments && attachments.length > 0
    });

    // Validate the forwarding address
    if (!to || typeof to !== "string") {
      return res.status(400).json({ error: "Invalid 'to' address" });
    }

    // Extract user info from forwarding address: receipts+userId_token@domain
    const forwardingMatch = to.match(/receipts\+([^_]+)_([^@]+)@/);
    if (!forwardingMatch) {
      return res.status(400).json({ error: "Invalid forwarding address format" });
    }

    const [, userId, token] = forwardingMatch;
    
    // Verify the forwarding address exists and is active
    const forwardingAddress = await storage.getForwardingAddress(userId);
    if (!forwardingAddress || forwardingAddress.token !== token || !forwardingAddress.isActive) {
      return res.status(404).json({ error: "Forwarding address not found or inactive" });
    }

    // Create a 'forwarding' email integration if it doesn't exist
    let integration = (await storage.getEmailIntegrationsByProvider("forwarding"))
      .find(i => i.userId === userId);
    
    if (!integration) {
      integration = await storage.createEmailIntegration({
        userId,
        provider: "forwarding",
        email: to,
        accessToken: "forwarding-token",
        status: "active",
      });
    }

    // Generate message ID for this forwarded email
    const messageId = `forwarding_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;

    // Store the processed message
    await storage.createProcessedMessage({
      emailIntegrationId: integration.id,
      messageId,
      subject: subject || "Forwarded Email",
      sender: from || "unknown@example.com",
      receivedAt: new Date(),
      processed: false,
      hasReceipt: false,
    });

    // Enqueue job to process the email content
    await simpleQueue.enqueue("email_process.message", {
      messageId,
      integrationId: integration.id,
      emailContent: {
        subject: subject || "Forwarded Email",
        from: from || "unknown@example.com",
        text: text || "",
        html: html || "",
        attachments: attachments || []
      },
      source: "forwarding"
    });

    console.log(`Forwarded email queued for processing: ${messageId}`);

    res.status(200).json({ 
      message: "Email received and queued for processing",
      messageId,
      integrationId: integration.id
    });
  } catch (error) {
    console.error("Email webhook error:", error);
    res.status(500).json({ error: "Email processing failed" });
  }
});

// POST /api/email/simulate-forwarding - Simulate receiving a forwarded email (for testing)
router.post("/simulate-forwarding", async (req: Request, res: Response) => {
  try {
    const { userId = "test-user-id", subject = "Test Receipt", from = "test@example.com" } = req.body;
    
    // Get or create forwarding address
    let forwardingAddress = await storage.getForwardingAddress(userId);
    if (!forwardingAddress) {
      const shortToken = crypto.randomBytes(8).toString("hex");
      const domain = process.env.FORWARDING_DOMAIN || "receiptify.app";
      const address = `receipts+${userId}_${shortToken}@${domain}`;
      
      forwardingAddress = await storage.createForwardingAddress({
        userId,
        address,
        token: shortToken,
        isActive: true,
      });
    }

    // Simulate incoming email
    const simulatedEmail = {
      to: forwardingAddress.address,
      from,
      subject,
      text: "Thank you for your purchase! Order total: £24.99",
      html: "<p>Thank you for your purchase!</p><p>Order total: £24.99</p>",
      attachments: []
    };

    // Process through webhook
    const webhookResponse = await fetch(`${req.protocol}://${req.get('host')}/api/email/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(simulatedEmail)
    });

    const result = await webhookResponse.json();

    res.json({
      message: "Forwarding simulation completed",
      forwardingAddress: forwardingAddress.address,
      simulatedEmail,
      webhookResult: result
    });
  } catch (error) {
    console.error("Simulate forwarding error:", error);
    res.status(500).json({ error: "Simulation failed" });
  }
});

export { router as forwardingInboxRouter };