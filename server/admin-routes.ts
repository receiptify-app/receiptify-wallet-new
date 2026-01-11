import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { simpleQueue } from "../lib/simple-queue";
import crypto from "crypto";
import bcrypt from "bcrypt";

const router = Router();
const SALT_ROUNDS = 12;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

interface AdminSession {
  adminId: string;
  email: string;
  name: string;
  expiresAt: number;
}

const adminSessions = new Map<string, AdminSession>();

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }
  
  const token = authHeader.split(' ')[1];
  const session = adminSessions.get(token);
  
  if (!session || session.expiresAt < Date.now()) {
    adminSessions.delete(token);
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  
  (req as any).adminSession = session;
  next();
}

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }
    
    const admin = await storage.getAdminByEmail(email);
    
    if (!admin || !admin.isActive) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    
    const passwordValid = await verifyPassword(password, admin.passwordHash);
    if (!passwordValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    
    await storage.updateAdminLastLogin(admin.id);
    
    const token = generateSessionToken();
    const session: AdminSession = {
      adminId: admin.id,
      email: admin.email,
      name: admin.name,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000
    };
    
    adminSessions.set(token, session);
    
    res.json({
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
      }
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/logout", requireAdminAuth, async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    adminSessions.delete(token);
  }
  res.json({ message: "Logged out successfully" });
});

router.get("/me", requireAdminAuth, async (req: Request, res: Response) => {
  const session = (req as any).adminSession as AdminSession;
  res.json({
    admin: {
      id: session.adminId,
      email: session.email,
      name: session.name,
    }
  });
});

router.post("/create", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    const session = (req as any).adminSession as AdminSession;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: "Email, password, and name required" });
    }
    
    const existingAdmin = await storage.getAdminByEmail(email);
    if (existingAdmin) {
      return res.status(409).json({ error: "Admin with this email already exists" });
    }
    
    const passwordHash = await hashPassword(password);
    
    const newAdmin = await storage.createAdmin({
      email,
      passwordHash,
      name,
      createdBy: session.adminId,
      isActive: true,
    });
    
    res.status(201).json({
      admin: {
        id: newAdmin.id,
        email: newAdmin.email,
        name: newAdmin.name,
        createdAt: newAdmin.createdAt,
      }
    });
  } catch (error) {
    console.error("Create admin error:", error);
    res.status(500).json({ error: "Failed to create admin" });
  }
});

router.get("/list", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const admins = await storage.getAdmins();
    
    res.json({
      admins: admins.map(admin => ({
        id: admin.id,
        email: admin.email,
        name: admin.name,
        isActive: admin.isActive,
        lastLoginAt: admin.lastLoginAt,
        createdAt: admin.createdAt,
      }))
    });
  } catch (error) {
    console.error("List admins error:", error);
    res.status(500).json({ error: "Failed to list admins" });
  }
});

router.patch("/:id/deactivate", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const session = (req as any).adminSession as AdminSession;
    
    if (id === session.adminId) {
      return res.status(400).json({ error: "Cannot deactivate yourself" });
    }
    
    const updated = await storage.updateAdmin(id, { isActive: false });
    
    if (!updated) {
      return res.status(404).json({ error: "Admin not found" });
    }
    
    res.json({ message: "Admin deactivated" });
  } catch (error) {
    console.error("Deactivate admin error:", error);
    res.status(500).json({ error: "Failed to deactivate admin" });
  }
});

router.get("/metrics", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const totalSignups = await storage.getTotalSignups();
    const dailyActiveUsers = await storage.getDailyActiveUsers();
    const signupDropoffs = await storage.getSignupDropoffs();
    const totalUsers = await storage.getTotalUsers();
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const allUsers = await storage.getAllUsers();
    const recentSignups = allUsers.filter(u => 
      u.createdAt && new Date(u.createdAt) > thirtyDaysAgo
    ).length;
    
    const weeklyActiveUsers: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dau = await storage.getDailyActiveUsers(date);
      weeklyActiveUsers.push(dau);
    }
    
    res.json({
      metrics: {
        totalSignups,
        totalUsers,
        dailyActiveUsers,
        signupDropoffs,
        recentSignups30Days: recentSignups,
        weeklyActiveUsers,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Metrics error:", error);
    res.status(500).json({ error: "Failed to get metrics" });
  }
});

router.get("/users", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const users = await storage.getAllUsers();
    
    res.json({
      users: users.map(user => ({
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        authProvider: user.authProvider,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      })),
      total: users.length,
    });
  } catch (error) {
    console.error("List users error:", error);
    res.status(500).json({ error: "Failed to list users" });
  }
});

router.get("/check-setup", async (req: Request, res: Response) => {
  try {
    const adminCount = await storage.getAdminCount();
    res.json({ needsSetup: adminCount === 0 });
  } catch (error) {
    console.error("Check setup error:", error);
    res.status(500).json({ error: "Failed to check setup" });
  }
});

router.post("/setup", async (req: Request, res: Response) => {
  try {
    const adminCount = await storage.getAdminCount();
    
    if (adminCount > 0) {
      return res.status(400).json({ error: "Admin already exists. Use login instead." });
    }
    
    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: "Email, password, and name required" });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    
    const passwordHash = await hashPassword(password);
    
    const admin = await storage.createAdmin({
      email,
      passwordHash,
      name,
      createdBy: null,
      isActive: true,
    });
    
    const token = generateSessionToken();
    const session: AdminSession = {
      adminId: admin.id,
      email: admin.email,
      name: admin.name,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000
    };
    
    adminSessions.set(token, session);
    
    res.status(201).json({
      message: "Admin account created successfully",
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
      }
    });
  } catch (error) {
    console.error("Setup error:", error);
    res.status(500).json({ error: "Failed to create admin" });
  }
});

router.get("/email-integrations", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string || "test-user-id";
    
    const integrations = await storage.getEmailIntegrations(userId);
    
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
      hasSyncCursor: !!integration.syncCursor,
      daysSinceLastSync: integration.lastSyncAt 
        ? Math.floor((Date.now() - new Date(integration.lastSyncAt).getTime()) / (1000 * 60 * 60 * 24))
        : null
    }));

    const pendingReceipts = await storage.getPendingReceipts(userId);
    
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

router.post("/backfill", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { integrationId, days = 90 } = req.body;
    
    if (!integrationId) {
      return res.status(400).json({ error: "integrationId required" });
    }

    const integration = await storage.getEmailIntegration(integrationId);
    if (!integration) {
      return res.status(404).json({ error: "Integration not found" });
    }

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

router.get("/pending-receipts", requireAdminAuth, async (req: Request, res: Response) => {
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

router.get("/queue-status", requireAdminAuth, async (req: Request, res: Response) => {
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

router.post("/test-integration", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { integrationId } = req.body;
    
    if (!integrationId) {
      return res.status(400).json({ error: "integrationId required" });
    }

    const integration = await storage.getEmailIntegration(integrationId);
    if (!integration) {
      return res.status(404).json({ error: "Integration not found" });
    }

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
