import type { Express, Response } from "express";
import { randomBytes } from "crypto";
import { db } from "./db";
import {
  splitFolders,
  splitFolderMembers,
  splitAssignments,
  receipts,
  receiptItems,
  users,
  insertSplitFolderSchema,
  type SplitFolder,
  type SplitFolderMember,
  type SplitAssignment,
  type Receipt,
  type ReceiptItem,
} from "@shared/schema";
import { and, desc, eq, inArray, ilike } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "./auth-middleware";

function newToken() {
  return randomBytes(24).toString("base64url");
}

function num(n: string | number | null | undefined): number {
  if (n === null || n === undefined) return 0;
  return typeof n === "number" ? n : parseFloat(n);
}

async function getFolderForUser(folderId: string, userId: string): Promise<SplitFolder | null> {
  const [folder] = await db.select().from(splitFolders).where(eq(splitFolders.id, folderId));
  if (!folder) return null;
  if (folder.ownerId === userId) return folder;
  const [member] = await db
    .select()
    .from(splitFolderMembers)
    .where(
      and(
        eq(splitFolderMembers.folderId, folderId),
        eq(splitFolderMembers.userId, userId),
        eq(splitFolderMembers.status, "active"),
      ),
    );
  return member ? folder : null;
}

type FolderSummary = SplitFolder & {
  totalAmount: number;
  memberCount: number;
  receiptCount: number;
  members: SplitFolderMember[];
  status: "settled" | "pending";
};

async function buildFolderSummary(folder: SplitFolder): Promise<FolderSummary> {
  const members = await db
    .select()
    .from(splitFolderMembers)
    .where(eq(splitFolderMembers.folderId, folder.id));
  const folderReceipts = await db
    .select()
    .from(receipts)
    .where(eq(receipts.splitFolderId, folder.id));
  const assignments = await db
    .select()
    .from(splitAssignments)
    .where(eq(splitAssignments.folderId, folder.id));
  const totalAmount = folderReceipts.reduce((s, r) => s + num(r.total), 0);
  const allSettled =
    assignments.length > 0 && assignments.every((a) => a.status === "paid");
  return {
    ...folder,
    totalAmount,
    memberCount: members.filter((m) => m.status !== "removed").length,
    receiptCount: folderReceipts.length,
    members,
    status: allSettled ? "settled" : "pending",
  };
}

const createFolderBody = insertSplitFolderSchema.omit({ ownerId: true });
const inviteBody = z
  .object({
    username: z.string().trim().min(1).optional(),
    email: z.string().email().optional(),
    displayName: z.string().trim().min(1).optional(),
    generateLinkOnly: z.boolean().optional(),
  })
  .refine(
    (d) => !!d.username || !!d.email || !!d.generateLinkOnly,
    "Provide a username, email, or set generateLinkOnly",
  );

const assignmentInput = z.object({
  memberId: z.string(),
  itemId: z.string().nullable().optional(),
  shareAmount: z.union([z.string(), z.number()]).transform((v) => String(v)),
});
const setAssignmentsBody = z.object({
  mode: z.enum(["whole", "items"]),
  assignments: z.array(assignmentInput),
});

export function registerSplitFolderRoutes(app: Express) {
  // --- Username autocomplete (for invite typeahead) ---
  app.get("/api/users/search", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const q = String(req.query.q || "").trim();
    if (q.length < 1) return res.json([]);
    // Username-only search so this can't be abused to probe whether arbitrary emails are registered.
    const rows = await db
      .select({ id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName, profileImageUrl: users.profileImageUrl })
      .from(users)
      .where(ilike(users.username, `${q}%`))
      .limit(8);
    res.json(rows.filter((r) => r.id !== req.user!.id));
  });

  // --- List folders the user belongs to ---
  app.get("/api/split-folders", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const owned = await db.select().from(splitFolders).where(eq(splitFolders.ownerId, userId));
    const memberships = await db
      .select({ folderId: splitFolderMembers.folderId })
      .from(splitFolderMembers)
      .where(
        and(eq(splitFolderMembers.userId, userId), eq(splitFolderMembers.status, "active")),
      );
    const memberFolderIds = memberships.map((m) => m.folderId);
    const memberFolders = memberFolderIds.length
      ? await db.select().from(splitFolders).where(inArray(splitFolders.id, memberFolderIds))
      : [];
    const map = new Map<string, SplitFolder>();
    [...owned, ...memberFolders].forEach((f) => map.set(f.id, f));
    const summaries = await Promise.all(Array.from(map.values()).map(buildFolderSummary));
    summaries.sort(
      (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
    );
    res.json(summaries);
  });

  // --- Create folder ---
  app.post("/api/split-folders", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const body = createFolderBody.parse(req.body);
      const userId = req.user!.id;
      const [folder] = await db
        .insert(splitFolders)
        .values({ ...body, ownerId: userId })
        .returning();
      // Add owner as an active member so they show up in member lists and assignments.
      await db.insert(splitFolderMembers).values({
        folderId: folder.id,
        userId,
        displayName: req.user!.name || req.user!.email || "You",
        inviteToken: newToken(),
        status: "active",
        role: "owner",
        joinedAt: new Date(),
      });
      res.status(201).json(folder);
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "Failed to create folder" });
    }
  });

  // --- Get folder detail ---
  app.get("/api/split-folders/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const folder = await getFolderForUser(req.params.id, userId);
    if (!folder) return res.status(404).json({ error: "Folder not found" });

    const members = await db
      .select()
      .from(splitFolderMembers)
      .where(eq(splitFolderMembers.folderId, folder.id));
    const folderReceipts = await db
      .select()
      .from(receipts)
      .where(eq(receipts.splitFolderId, folder.id))
      .orderBy(desc(receipts.date));
    const receiptIds = folderReceipts.map((r) => r.id);
    const items = receiptIds.length
      ? await db.select().from(receiptItems).where(inArray(receiptItems.receiptId, receiptIds))
      : [];
    const assignments = await db
      .select()
      .from(splitAssignments)
      .where(eq(splitAssignments.folderId, folder.id));

    const itemsByReceipt = new Map<string, ReceiptItem[]>();
    items.forEach((it) => {
      const arr = itemsByReceipt.get(it.receiptId) || [];
      arr.push(it);
      itemsByReceipt.set(it.receiptId, arr);
    });
    const assignmentsByReceipt = new Map<string, SplitAssignment[]>();
    assignments.forEach((a) => {
      const arr = assignmentsByReceipt.get(a.receiptId) || [];
      arr.push(a);
      assignmentsByReceipt.set(a.receiptId, arr);
    });

    // Settlement aggregated per member
    const settlement = members
      .filter((m) => m.status !== "removed")
      .map((m) => {
        const mine = assignments.filter((a) => a.memberId === m.id);
        const pending = mine
          .filter((a) => a.status === "pending")
          .reduce((s, a) => s + num(a.shareAmount), 0);
        const paid = mine
          .filter((a) => a.status === "paid")
          .reduce((s, a) => s + num(a.shareAmount), 0);
        return {
          memberId: m.id,
          displayName: m.displayName,
          userId: m.userId,
          inviteEmail: m.inviteEmail,
          role: m.role,
          owed: pending,
          paid,
          total: pending + paid,
          status: pending === 0 && (paid > 0 || mine.length === 0) ? "settled" : "pending",
        };
      });

    res.json({
      folder,
      members,
      receipts: folderReceipts.map((r) => ({
        ...r,
        items: itemsByReceipt.get(r.id) || [],
        assignments: assignmentsByReceipt.get(r.id) || [],
      })),
      settlement,
      totalAmount: folderReceipts.reduce((s, r) => s + num(r.total), 0),
      isOwner: folder.ownerId === userId,
    });
  });

  // --- Attach a receipt to the folder (moves it if it was in another) ---
  app.post(
    "/api/split-folders/:id/receipts",
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user!.id;
      const folder = await getFolderForUser(req.params.id, userId);
      if (!folder) return res.status(404).json({ error: "Folder not found" });
      const receiptId = z.string().parse(req.body?.receiptId);
      const [receipt] = await db.select().from(receipts).where(eq(receipts.id, receiptId));
      if (!receipt || receipt.userId !== userId) {
        return res.status(404).json({ error: "Receipt not found" });
      }
      if (receipt.splitFolderId && receipt.splitFolderId !== folder.id) {
        // Clear assignments from the previous folder for this receipt.
        await db
          .delete(splitAssignments)
          .where(
            and(
              eq(splitAssignments.folderId, receipt.splitFolderId),
              eq(splitAssignments.receiptId, receiptId),
            ),
          );
      }
      const [updated] = await db
        .update(receipts)
        .set({ splitFolderId: folder.id })
        .where(eq(receipts.id, receiptId))
        .returning();
      res.json(updated);
    },
  );

  // --- Detach a receipt from a folder ---
  // Only the receipt owner or the folder owner may detach, since this wipes assignments.
  app.delete(
    "/api/split-folders/:id/receipts/:receiptId",
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user!.id;
      const folder = await getFolderForUser(req.params.id, userId);
      if (!folder) return res.status(404).json({ error: "Folder not found" });
      const [receipt] = await db
        .select()
        .from(receipts)
        .where(eq(receipts.id, req.params.receiptId));
      if (!receipt || receipt.splitFolderId !== folder.id) {
        return res.status(404).json({ error: "Receipt not in folder" });
      }
      if (receipt.userId !== userId && folder.ownerId !== userId) {
        return res.status(403).json({ error: "Only the receipt owner or folder owner can remove this receipt" });
      }
      await db
        .delete(splitAssignments)
        .where(
          and(
            eq(splitAssignments.folderId, folder.id),
            eq(splitAssignments.receiptId, req.params.receiptId),
          ),
        );
      await db
        .update(receipts)
        .set({ splitFolderId: null })
        .where(and(eq(receipts.id, req.params.receiptId), eq(receipts.splitFolderId, folder.id)));
      res.json({ ok: true });
    },
  );

  // --- Invite a member (or just generate a shareable link) ---
  app.post(
    "/api/split-folders/:id/members",
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user!.id;
        const folder = await getFolderForUser(req.params.id, userId);
        if (!folder) return res.status(404).json({ error: "Folder not found" });
        const body = inviteBody.parse(req.body);

        let invitedUserId: string | null = null;
        let inviteEmail: string | null = body.email ?? null;
        let inviteUsername: string | null = body.username ?? null;
        let displayName = body.displayName || body.username || body.email || "Invited friend";

        if (body.username) {
          const [u] = await db
            .select()
            .from(users)
            .where(eq(users.username, body.username));
          if (u) {
            invitedUserId = u.id;
            displayName = body.displayName || [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || displayName;
          }
        } else if (body.email) {
          const [u] = await db.select().from(users).where(eq(users.email, body.email));
          if (u) {
            invitedUserId = u.id;
            displayName = body.displayName || [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || body.email;
          }
        }

        const [member] = await db
          .insert(splitFolderMembers)
          .values({
            folderId: folder.id,
            userId: invitedUserId,
            inviteEmail,
            inviteUsername,
            displayName,
            inviteToken: newToken(),
            // If the invitee already has a Receiptify account we mark them active straight away.
            status: invitedUserId ? "active" : "invited",
            role: "member",
            joinedAt: invitedUserId ? new Date() : null,
          })
          .returning();
        res.status(201).json(member);
      } catch (err: any) {
        res.status(400).json({ error: err?.message || "Failed to invite" });
      }
    },
  );

  // --- Remove a member ---
  app.delete(
    "/api/split-folders/:id/members/:memberId",
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user!.id;
      const folder = await getFolderForUser(req.params.id, userId);
      if (!folder) return res.status(404).json({ error: "Folder not found" });
      if (folder.ownerId !== userId) {
        return res.status(403).json({ error: "Only the folder owner can remove members" });
      }
      const [member] = await db
        .select()
        .from(splitFolderMembers)
        .where(eq(splitFolderMembers.id, req.params.memberId));
      if (!member || member.folderId !== folder.id) {
        return res.status(404).json({ error: "Member not found" });
      }
      if (member.role === "owner") {
        return res.status(400).json({ error: "Cannot remove the folder owner" });
      }
      await db
        .delete(splitAssignments)
        .where(eq(splitAssignments.memberId, member.id));
      await db
        .update(splitFolderMembers)
        .set({ status: "removed" })
        .where(eq(splitFolderMembers.id, member.id));
      res.json({ ok: true });
    },
  );

  // --- Accept invite (auth required, joins current user to folder) ---
  app.post(
    "/api/split-folders/invites/:token/accept",
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user!.id;
      const [member] = await db
        .select()
        .from(splitFolderMembers)
        .where(eq(splitFolderMembers.inviteToken, req.params.token));
      if (!member) return res.status(404).json({ error: "Invite not found" });
      if (member.status === "removed") {
        return res.status(410).json({ error: "Invite revoked" });
      }
      // If the seat is unclaimed, bind it to this user.
      if (!member.userId) {
        await db
          .update(splitFolderMembers)
          .set({ userId, status: "active", joinedAt: new Date() })
          .where(eq(splitFolderMembers.id, member.id));
      } else if (member.userId !== userId) {
        return res.status(403).json({ error: "This invite belongs to another account" });
      } else if (member.status !== "active") {
        await db
          .update(splitFolderMembers)
          .set({ status: "active", joinedAt: new Date() })
          .where(eq(splitFolderMembers.id, member.id));
      }
      res.json({ folderId: member.folderId });
    },
  );

  // --- Public invite preview (no auth) so the join page can show folder name ---
  app.get("/api/split-folders/invites/:token", async (req, res: Response) => {
    const [member] = await db
      .select()
      .from(splitFolderMembers)
      .where(eq(splitFolderMembers.inviteToken, req.params.token));
    if (!member || member.status === "removed") {
      return res.status(404).json({ error: "Invite not found" });
    }
    const [folder] = await db.select().from(splitFolders).where(eq(splitFolders.id, member.folderId));
    if (!folder) return res.status(404).json({ error: "Invite not found" });
    res.json({ folderName: folder.name, folderDescription: folder.description, alreadyActive: member.status === "active" });
  });

  // --- Set split mode + assignments for a receipt in a folder ---
  app.put(
    "/api/split-folders/:id/receipts/:receiptId/assignments",
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user!.id;
        const folder = await getFolderForUser(req.params.id, userId);
        if (!folder) return res.status(404).json({ error: "Folder not found" });
        const [receipt] = await db
          .select()
          .from(receipts)
          .where(eq(receipts.id, req.params.receiptId));
        if (!receipt || receipt.splitFolderId !== folder.id) {
          return res.status(404).json({ error: "Receipt not in folder" });
        }
        // Only the receipt owner or folder owner can change who pays what.
        if (receipt.userId !== userId && folder.ownerId !== userId) {
          return res.status(403).json({ error: "Only the receipt owner or folder owner can edit assignments" });
        }
        const body = setAssignmentsBody.parse(req.body);

        // Validate the total of all share amounts is within a small rounding tolerance
        // of the receipt total — prevents clients sending arbitrary inflated/deflated shares.
        const sum = body.assignments.reduce((s, a) => s + parseFloat(a.shareAmount || "0"), 0);
        const receiptTotal = parseFloat(receipt.total);
        const tolerance = Math.max(0.05, body.assignments.length * 0.01);
        if (body.assignments.length > 0 && Math.abs(sum - receiptTotal) > tolerance) {
          return res.status(400).json({
            error: `Assignment total £${sum.toFixed(2)} doesn't match receipt total £${receiptTotal.toFixed(2)}`,
          });
        }

        const memberIds = new Set(body.assignments.map((a) => a.memberId));
        if (memberIds.size > 0) {
          const memberRows = await db
            .select()
            .from(splitFolderMembers)
            .where(inArray(splitFolderMembers.id, Array.from(memberIds)));
          if (memberRows.length !== memberIds.size || memberRows.some((m) => m.folderId !== folder.id)) {
            return res.status(400).json({ error: "Invalid member references" });
          }
        }

        await db
          .delete(splitAssignments)
          .where(
            and(
              eq(splitAssignments.folderId, folder.id),
              eq(splitAssignments.receiptId, receipt.id),
            ),
          );
        if (body.assignments.length) {
          await db.insert(splitAssignments).values(
            body.assignments.map((a) => ({
              folderId: folder.id,
              receiptId: receipt.id,
              memberId: a.memberId,
              itemId: a.itemId || null,
              shareAmount: a.shareAmount,
              status: "pending" as const,
            })),
          );
        }
        const rows = await db
          .select()
          .from(splitAssignments)
          .where(
            and(
              eq(splitAssignments.folderId, folder.id),
              eq(splitAssignments.receiptId, receipt.id),
            ),
          );
        res.json({ assignments: rows, mode: body.mode });
      } catch (err: any) {
        res.status(400).json({ error: err?.message || "Failed to save assignments" });
      }
    },
  );

  // --- Mark a member's outstanding assignments as paid ---
  app.post(
    "/api/split-folders/:id/members/:memberId/settle",
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user!.id;
      const folder = await getFolderForUser(req.params.id, userId);
      if (!folder) return res.status(404).json({ error: "Folder not found" });
      // Only the folder owner can confirm a member has paid, so a debtor can't fake settlement.
      if (folder.ownerId !== userId) {
        return res.status(403).json({ error: "Only the folder owner can mark settlement" });
      }
      const [member] = await db
        .select()
        .from(splitFolderMembers)
        .where(eq(splitFolderMembers.id, req.params.memberId));
      if (!member || member.folderId !== folder.id) {
        return res.status(404).json({ error: "Member not found" });
      }
      await db
        .update(splitAssignments)
        .set({ status: "paid" })
        .where(
          and(
            eq(splitAssignments.folderId, folder.id),
            eq(splitAssignments.memberId, member.id),
          ),
        );
      res.json({ ok: true });
    },
  );
}
