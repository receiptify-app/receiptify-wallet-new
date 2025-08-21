import { Router } from "express";
import type { Request, Response } from "express";
import crypto from "crypto";
import { storage } from "./storage";
import { simpleQueue } from "../lib/simple-queue";

const router = Router();

// OAuth state storage (in production, use Redis)
const oauthStates = new Map<string, { userId: string; provider: string; timestamp: number }>();

// Clean up old states (older than 10 minutes)
setInterval(() => {
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  for (const [state, data] of oauthStates.entries()) {
    if (data.timestamp < tenMinutesAgo) {
      oauthStates.delete(state);
    }
  }
}, 5 * 60 * 1000); // Clean every 5 minutes

// A) Gmail Integration
router.get("/authorize", async (req: Request, res: Response) => {
  try {
    const { provider } = req.query;
    const userId = req.user?.id || "test-user-id"; // Get from auth
    
    if (!provider || (provider !== "gmail" && provider !== "outlook")) {
      return res.status(400).json({ error: "Invalid provider" });
    }

    const state = crypto.randomBytes(32).toString("hex");
    oauthStates.set(state, { userId, provider: provider as string, timestamp: Date.now() });

    if (provider === "gmail") {
      // Gmail OAuth
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/email/callback`;
      
      if (!clientId) {
        console.log("Gmail OAuth: GOOGLE_CLIENT_ID not set, checking existing integration");
        // Check for existing integration first
        const existingIntegrations = await storage.getEmailIntegrations(userId);
        const existingGmail = existingIntegrations.find(i => i.provider === "gmail");
        
        if (existingGmail) {
          return res.json({ 
            message: "Gmail OAuth stub already exists (GOOGLE_CLIENT_ID not set)", 
            integration: existingGmail 
          });
        }
        
        // Create stub integration for testing
        const stubIntegration = await storage.createEmailIntegration({
          userId,
          provider: "gmail",
          email: "stub-gmail@example.com",
          accessToken: "stub-access-token",
          refreshToken: "stub-refresh-token",
          syncCursor: "stub-history-id-12345",
          status: "active"
        });
        return res.json({ 
          message: "Gmail OAuth stub created (GOOGLE_CLIENT_ID not set)", 
          integration: stubIntegration 
        });
      }

      const scope = "https://www.googleapis.com/auth/gmail.readonly";
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scope)}&` +
        `response_type=code&` +
        `state=${state}&` +
        `access_type=offline&` +
        `prompt=consent`;

      res.json({ authUrl, provider: "gmail", state });
    } else if (provider === "outlook") {
      // Microsoft OAuth
      const clientId = process.env.MICROSOFT_CLIENT_ID;
      const redirectUri = process.env.MICROSOFT_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/email/callback`;
      
      if (!clientId) {
        console.log("Outlook OAuth: MICROSOFT_CLIENT_ID not set, checking existing integration");
        // Check for existing integration first
        const existingIntegrations = await storage.getEmailIntegrations(userId);
        const existingOutlook = existingIntegrations.find(i => i.provider === "outlook");
        
        if (existingOutlook) {
          return res.json({ 
            message: "Outlook OAuth stub already exists (MICROSOFT_CLIENT_ID not set)", 
            integration: existingOutlook 
          });
        }
        
        // Create stub integration for testing
        const stubIntegration = await storage.createEmailIntegration({
          userId,
          provider: "outlook",
          email: "stub-outlook@example.com",
          accessToken: "stub-access-token",
          refreshToken: "stub-refresh-token",
          syncCursor: "stub-delta-token-abc123",
          status: "active"
        });
        return res.json({ 
          message: "Outlook OAuth stub created (MICROSOFT_CLIENT_ID not set)", 
          integration: stubIntegration 
        });
      }

      const scope = "Mail.Read offline_access";
      const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scope)}&` +
        `response_type=code&` +
        `state=${state}&` +
        `response_mode=query`;

      res.json({ authUrl, provider: "outlook", state });
    }
  } catch (error) {
    console.error("OAuth authorize error:", error);
    res.status(500).json({ error: "OAuth authorization failed" });
  }
});

router.get("/callback", async (req: Request, res: Response) => {
  try {
    const { code, state, provider } = req.query;
    
    if (!code || !state) {
      return res.status(400).json({ error: "Missing code or state" });
    }

    const stateData = oauthStates.get(state as string);
    if (!stateData) {
      return res.status(400).json({ error: "Invalid or expired state" });
    }

    oauthStates.delete(state as string);
    
    const actualProvider = provider as string || stateData.provider;

    if (actualProvider === "gmail") {
      await handleGmailCallback(code as string, stateData.userId, req, res);
    } else if (actualProvider === "outlook") {
      await handleOutlookCallback(code as string, stateData.userId, req, res);
    } else {
      res.status(400).json({ error: "Invalid provider" });
    }
  } catch (error) {
    console.error("OAuth callback error:", error);
    res.status(500).json({ error: "OAuth callback failed" });
  }
});

async function handleGmailCallback(code: string, userId: string, req: Request, res: Response) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/email/callback`;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: "Google OAuth credentials not configured" });
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    const tokens = await tokenResponse.json();
    
    if (!tokenResponse.ok) {
      return res.status(400).json({ error: "Token exchange failed", details: tokens });
    }

    // Get user profile
    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileResponse.json();

    // Get initial historyId
    let syncCursor = null;
    try {
      const historyResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/history?maxResults=1", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const historyData = await historyResponse.json();
      syncCursor = historyData.historyId || "initial-history-id";
    } catch (error) {
      console.log("Could not get initial historyId, will use fallback");
      syncCursor = "initial-history-id";
    }

    // Store integration
    const integration = await storage.createEmailIntegration({
      userId,
      provider: "gmail",
      email: profile.email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiry: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
      syncCursor,
      status: "active",
    });

    // Enqueue backfill job
    await simpleQueue.enqueue("email_backfill", {
      integrationId: integration.id,
      days: 90,
    });

    res.json({ 
      message: "Gmail integration successful", 
      integration,
      backfillJobEnqueued: true
    });
  } catch (error) {
    console.error("Gmail callback error:", error);
    res.status(500).json({ error: "Gmail integration failed" });
  }
}

async function handleOutlookCallback(code: string, userId: string, req: Request, res: Response) {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/email/callback`;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: "Microsoft OAuth credentials not configured" });
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        scope: "Mail.Read offline_access",
      }),
    });

    const tokens = await tokenResponse.json();
    
    if (!tokenResponse.ok) {
      return res.status(400).json({ error: "Token exchange failed", details: tokens });
    }

    // Get user profile
    const profileResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileResponse.json();

    // Get initial delta token
    let syncCursor = null;
    try {
      const deltaResponse = await fetch("https://graph.microsoft.com/v1.0/me/messages/delta?$top=1", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const deltaData = await deltaResponse.json();
      // Extract deltaToken from @odata.deltaLink
      const deltaLink = deltaData["@odata.deltaLink"];
      if (deltaLink) {
        const deltaMatch = deltaLink.match(/\$deltatoken=([^&]+)/);
        syncCursor = deltaMatch ? deltaMatch[1] : "initial-delta-token";
      } else {
        syncCursor = "initial-delta-token";
      }
    } catch (error) {
      console.log("Could not get initial delta token, will use fallback");
      syncCursor = "initial-delta-token";
    }

    // Store integration
    const integration = await storage.createEmailIntegration({
      userId,
      provider: "outlook",
      email: profile.mail || profile.userPrincipalName,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiry: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
      syncCursor,
      status: "active",
    });

    // Enqueue backfill job
    await simpleQueue.enqueue("email_backfill", {
      integrationId: integration.id,
      days: 90,
    });

    res.json({ 
      message: "Outlook integration successful", 
      integration,
      backfillJobEnqueued: true
    });
  } catch (error) {
    console.error("Outlook callback error:", error);
    res.status(500).json({ error: "Outlook integration failed" });
  }
}

// Gmail push notification endpoint
router.post("/gmail/push", async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    
    if (!message || !message.data) {
      return res.status(400).json({ error: "Invalid push notification" });
    }

    // Decode the base64 message
    const decodedData = Buffer.from(message.data, 'base64').toString();
    const notification = JSON.parse(decodedData);
    
    console.log("Gmail push notification received:", notification);

    // Find the integration by historyId or email address
    const integrations = await storage.getEmailIntegrationsByProvider("gmail");
    
    for (const integration of integrations) {
      // Enqueue job to process new messages for this integration
      await simpleQueue.enqueue("email_process.poll", {
        integrationId: integration.id,
        historyId: notification.historyId
      });
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Gmail push notification error:", error);
    res.status(500).json({ error: "Push notification processing failed" });
  }
});

// Outlook webhook notification endpoint
router.post("/outlook/push", async (req: Request, res: Response) => {
  try {
    const { value } = req.body;
    
    if (!value || !Array.isArray(value)) {
      return res.status(400).json({ error: "Invalid Outlook notification" });
    }

    console.log("Outlook push notification received:", value);

    for (const notification of value) {
      // Find integration by resource (which contains the user's mailbox)
      const integrations = await storage.getEmailIntegrationsByProvider("outlook");
      
      for (const integration of integrations) {
        // Enqueue job to process new messages for this integration
        await simpleQueue.enqueue("email_process.poll", {
          integrationId: integration.id,
          changeType: notification.changeType,
          resource: notification.resource
        });
      }
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Outlook push notification error:", error);
    res.status(500).json({ error: "Push notification processing failed" });
  }
});

// Manual poll endpoint for testing
router.post("/poll", async (req: Request, res: Response) => {
  try {
    const { integrationId, provider } = req.body;
    
    if (!integrationId) {
      return res.status(400).json({ error: "integrationId required" });
    }

    const integration = await storage.getEmailIntegration(integrationId);
    if (!integration) {
      return res.status(404).json({ error: "Integration not found" });
    }

    // Enqueue poll job
    await simpleQueue.enqueue("email_process.poll", {
      integrationId: integration.id,
    });

    res.json({ message: "Poll job enqueued", integrationId });
  } catch (error) {
    console.error("Manual poll error:", error);
    res.status(500).json({ error: "Poll failed" });
  }
});

export { router as emailOAuthRouter };