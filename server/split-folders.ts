import type { Express, Response } from "express";
import { randomBytes } from "crypto";
import { z } from "zod";
import { storage } from "./storage";
import { splitFolderStorage } from "./split-folder-storage";
import { sendEmail } from "./email-sender";
import {
  insertSplitFolderSchema,
  type SplitFolder,
  type SplitFolderMember,
  type SplitAssignment,
  type ReceiptItem,
} from "@shared/schema";
import { requireAuth, type AuthenticatedRequest } from "./auth-middleware";

function newToken() {
  return randomBytes(24).toString("base64url");
}

function num(n: string | number | null | undefined): number {
  if (n === null || n === undefined) return 0;
  return typeof n === "number" ? n : parseFloat(n);
}

// Convert a receipt total to GBP using the snapshotted exchange rate.
// GBP receipts have a null rate so they stay unchanged.
function totalInGBP(r: { total: string | number; exchangeRateToGBP: string | number | null }): number {
  const rawTotal = num(r.total);
  let rate = r.exchangeRateToGBP ? num(r.exchangeRateToGBP) : 1;
  if (!isFinite(rate)) rate = 1;
  return rawTotal * rate;
}

// Convert an item price to GBP using the parent receipt's exchange rate.
function itemPriceInGBP(
  item: { price: string | number },
  receipt: { exchangeRateToGBP: string | number | null },
): number {
  const rawPrice = num(item.price);
  let rate = receipt.exchangeRateToGBP ? num(receipt.exchangeRateToGBP) : 1;
  if (!isFinite(rate)) rate = 1;
  return rawPrice * rate;
}

async function loadFolderForUser(folderId: string, userId: string): Promise<SplitFolder | null> {
  const folder = await splitFolderStorage.getFolder(folderId);
  if (!folder) return null;
  if (folder.ownerId === userId) return folder;
  return (await splitFolderStorage.isUserActiveInFolder(folderId, userId)) ? folder : null;
}

// inviteToken is a secret used as the join URL; never leak it in list/detail responses.
// (The token is returned once at invite-creation time so the owner can share the link.)
function sanitizeMember(m: SplitFolderMember) {
  const { inviteToken, ...safe } = m;
  return safe;
}

async function buildFolderSummary(folder: SplitFolder) {
  const [members, folderReceipts, assignments] = await Promise.all([
    splitFolderStorage.listMembers(folder.id),
    splitFolderStorage.listFolderReceipts(folder.id),
    splitFolderStorage.listAssignments(folder.id),
  ]);
  const totalAmount = folderReceipts.reduce((s, r) => s + totalInGBP(r), 0);
  const allSettled =
    assignments.length > 0 && assignments.every((a) => a.status === "paid");
  return {
    ...folder,
    totalAmount,
    memberCount: members.filter((m) => m.status !== "removed").length,
    receiptCount: folderReceipts.length,
    members: members.filter((m) => m.status !== "removed").map(sanitizeMember),
    status: allSettled ? "settled" : "pending",
  };
}

const createFolderBody = insertSplitFolderSchema.omit({ ownerId: true });
const inviteBody = z
  .object({
    email: z.string().email().optional(),
    displayName: z.string().trim().min(1).optional(),
    generateLinkOnly: z.boolean().optional(),
  })
  .refine(
    (d) => !!d.email || !!d.generateLinkOnly,
    "Provide an email or set generateLinkOnly",
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

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatReceiptDate(d: Date | string | null | undefined) {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function inviteEmailBody(
  folderName: string,
  inviterName: string,
  link: string,
  receipts: Array<{ merchantName: string; total: string | number; date: Date | string | null }>,
) {
  const receiptsForEmail = receipts.slice(0, 8);
  const moreCount = Math.max(0, receipts.length - receiptsForEmail.length);

  const receiptsTextLines = receiptsForEmail.map((r) => {
    const date = formatReceiptDate(r.date);
    const amount = `£${num(r.total).toFixed(2)}`;
    return `  • ${r.merchantName}${date ? ` (${date})` : ""} — ${amount}`;
  });
  const receiptsText =
    receipts.length > 0
      ? `\nReceipts shared in this folder:\n${receiptsTextLines.join("\n")}${
          moreCount > 0 ? `\n  • …and ${moreCount} more` : ""
        }\n`
      : "\nNo receipts have been added to this folder yet.\n";

  const receiptsHtml =
    receipts.length > 0
      ? `<p style="margin-bottom:6px"><strong>Receipts shared in this folder:</strong></p>
<ul style="padding-left:18px;margin-top:0">
${receiptsForEmail
  .map((r) => {
    const date = formatReceiptDate(r.date);
    return `<li style="margin-bottom:4px">${escapeHtml(r.merchantName)}${
      date ? ` <span style="color:#666">(${escapeHtml(date)})</span>` : ""
    } — £${num(r.total).toFixed(2)}</li>`;
  })
  .join("\n")}
${moreCount > 0 ? `<li style="color:#666">…and ${moreCount} more</li>` : ""}
</ul>`
      : `<p style="color:#666">No receipts have been added to this folder yet.</p>`;

  const text = `${inviterName} invited you to split receipts on Receiptify.

Folder: ${folderName}
${receiptsText}
Join: ${link}

If you don't have an account yet, you'll be asked to sign up first.`;

  const html = `<p><strong>${escapeHtml(inviterName)}</strong> invited you to split receipts on <strong>Receiptify</strong>.</p>
<p>Folder: <strong>${escapeHtml(folderName)}</strong></p>
${receiptsHtml}
<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#16a34a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Tap here to join the folder</a></p>
<p style="color:#666;font-size:12px">If you don't have an account yet, you'll be asked to sign up first.</p>`;

  return { text, html };
}

function inviteOrigin(req: { headers: any; protocol: string; get: (k: string) => string | undefined }) {
  return req.headers.origin?.toString() || `${req.protocol}://${req.get("host")}`;
}

async function sendInviteEmail(
  toEmail: string,
  inviterName: string,
  folder: SplitFolder,
  inviteToken: string,
  origin: string,
) {
  const link = `${origin}/split/invite/${inviteToken}`;
  const folderReceipts = await splitFolderStorage.listFolderReceipts(folder.id);
  const receiptsForEmail = folderReceipts.map((r) => ({
    merchantName: r.merchantName,
    total: totalInGBP(r),
    date: r.date,
  }));
  const { text, html } = inviteEmailBody(folder.name, inviterName, link, receiptsForEmail);
  return sendEmail({
    to: toEmail,
    subject: `${inviterName} invited you to split a Receiptify folder`,
    text,
    html,
  });
}

export function registerSplitFolderRoutes(app: Express) {
  // --- List folders the user belongs to ---
  app.get("/api/split-folders", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const folders = await splitFolderStorage.listFoldersForUser(req.user!.id);
    const summaries = await Promise.all(folders.map(buildFolderSummary));
    res.json(summaries);
  });

  // --- Create folder ---
  app.post("/api/split-folders", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const body = createFolderBody.parse(req.body);
      const userId = req.user!.id;
      const folder = await splitFolderStorage.createFolder({ ...body, ownerId: userId });
      // Owner is added as an active member so they show up in member lists and assignments.
      await splitFolderStorage.createMember({
        folderId: folder.id,
        userId,
        displayName: req.user!.name || req.user!.email || "You",
        inviteToken: newToken(),
        status: "active",
        role: "owner",
      });
      res.status(201).json(folder);
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "Failed to create folder" });
    }
  });

  // --- Get folder detail ---
  app.get("/api/split-folders/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const folder = await loadFolderForUser(req.params.id, userId);
    if (!folder) return res.status(404).json({ error: "Folder not found" });

    const [members, folderReceipts, assignments] = await Promise.all([
      splitFolderStorage.listMembers(folder.id),
      splitFolderStorage.listFolderReceipts(folder.id),
      splitFolderStorage.listAssignments(folder.id),
    ]);
    const items = await splitFolderStorage.getReceiptItemsForReceipts(folderReceipts.map((r) => r.id));

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

    // Per-member settlement is always computed, never stored.
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
      members: members.filter((m) => m.status !== "removed").map(sanitizeMember),
      receipts: folderReceipts.map((r) => ({
        ...r,
        total: String(totalInGBP(r)),
        items: (itemsByReceipt.get(r.id) || []).map((item) => ({
          ...item,
          price: String(itemPriceInGBP(item, r)),
        })),
        assignments: assignmentsByReceipt.get(r.id) || [],
      })),
      settlement,
      totalAmount: folderReceipts.reduce((s, r) => s + totalInGBP(r), 0),
      isOwner: folder.ownerId === userId,
    });
  });

  // --- Attach a receipt (moves it from any prior folder, clearing old assignments) ---
  app.post(
    "/api/split-folders/:id/receipts",
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user!.id;
      const folder = await loadFolderForUser(req.params.id, userId);
      if (!folder) return res.status(404).json({ error: "Folder not found" });
      const receiptId = z.string().parse(req.body?.receiptId);
      const receipt = await storage.getReceipt(receiptId);
      if (!receipt || receipt.userId !== userId) {
        return res.status(404).json({ error: "Receipt not found" });
      }
      if (receipt.splitFolderId && receipt.splitFolderId !== folder.id) {
        await splitFolderStorage.clearReceiptAssignments(receipt.splitFolderId, receiptId);
      }
      const updated = await splitFolderStorage.attachReceipt(receiptId, folder.id);
      res.json(updated);
    },
  );

  // --- Detach a receipt — only the receipt owner or the folder owner can do this ---
  app.delete(
    "/api/split-folders/:id/receipts/:receiptId",
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user!.id;
      const folder = await loadFolderForUser(req.params.id, userId);
      if (!folder) return res.status(404).json({ error: "Folder not found" });
      const receipt = await storage.getReceipt(req.params.receiptId);
      if (!receipt || receipt.splitFolderId !== folder.id) {
        return res.status(404).json({ error: "Receipt not in folder" });
      }
      if (receipt.userId !== userId && folder.ownerId !== userId) {
        return res.status(403).json({ error: "Only the receipt owner or folder owner can remove this receipt" });
      }
      await splitFolderStorage.clearReceiptAssignments(folder.id, receipt.id);
      await splitFolderStorage.detachReceipt(receipt.id, folder.id);
      res.json({ ok: true });
    },
  );

  // --- Invite a member (or generate a shareable link) ---
  app.post(
    "/api/split-folders/:id/members",
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user!.id;
        const folder = await loadFolderForUser(req.params.id, userId);
        if (!folder) return res.status(404).json({ error: "Folder not found" });
        const body = inviteBody.parse(req.body);

        let invitedUserId: string | null = null;
        let inviteEmail: string | null = body.email ?? null;
        let displayName = body.displayName || body.email || "Invited friend";

        if (body.email) {
          const u = await splitFolderStorage.findUserByEmail(body.email);
          if (u) {
            invitedUserId = u.id;
            displayName = body.displayName || [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || body.email;
          }
        }

        const member = await splitFolderStorage.createMember({
          folderId: folder.id,
          userId: invitedUserId,
          inviteEmail,
          displayName,
          inviteToken: newToken(),
          // If the invitee already has a Receiptify account, mark them active straight away.
          status: invitedUserId ? "active" : "invited",
          role: "member",
        });
        if (invitedUserId) {
          await splitFolderStorage.updateMember(member.id, { joinedAt: new Date() });
        }

        // Email dispatch for email-based invites only (link tab returns the URL for manual share)
        let emailSent = false;
        let emailError: string | undefined;
        if (body.email && !body.generateLinkOnly) {
          const inviter = req.user!.name || req.user!.email || "A friend";
          const result = await sendInviteEmail(
            body.email,
            inviter,
            folder,
            member.inviteToken,
            inviteOrigin(req),
          );
          emailSent = result.sent;
          emailError = result.reason;
        }

        res.status(201).json({ ...member, emailSent, emailError });
      } catch (err: any) {
        res.status(400).json({ error: err?.message || "Failed to invite" });
      }
    },
  );

  // --- Resend an email invite (owner only) ---
  app.post(
    "/api/split-folders/:id/members/:memberId/resend-invite",
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user!.id;
      const folder = await loadFolderForUser(req.params.id, userId);
      if (!folder) return res.status(404).json({ error: "Folder not found" });
      if (folder.ownerId !== userId) {
        return res.status(403).json({ error: "Only the folder owner can resend invites" });
      }
      const member = await splitFolderStorage.getMember(req.params.memberId);
      if (!member || member.folderId !== folder.id) {
        return res.status(404).json({ error: "Member not found" });
      }
      if (member.status === "removed") {
        return res.status(410).json({ error: "Invite has been revoked" });
      }
      if (!member.inviteEmail) {
        return res.status(400).json({ error: "This invite has no email to send to" });
      }

      const inviter = req.user!.name || req.user!.email || "A friend";
      const result = await sendInviteEmail(
        member.inviteEmail,
        inviter,
        folder,
        member.inviteToken,
        inviteOrigin(req),
      );
      if (!result.sent) {
        return res.status(502).json({
          emailSent: false,
          emailError: result.reason || "Failed to send invite email",
        });
      }
      res.json({ emailSent: true });
    },
  );

  // --- Remove a member (owner only) ---
  app.delete(
    "/api/split-folders/:id/members/:memberId",
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user!.id;
      const folder = await loadFolderForUser(req.params.id, userId);
      if (!folder) return res.status(404).json({ error: "Folder not found" });
      if (folder.ownerId !== userId) {
        return res.status(403).json({ error: "Only the folder owner can remove members" });
      }
      const member = await splitFolderStorage.getMember(req.params.memberId);
      if (!member || member.folderId !== folder.id) {
        return res.status(404).json({ error: "Member not found" });
      }
      if (member.role === "owner") {
        return res.status(400).json({ error: "Cannot remove the folder owner" });
      }
      await splitFolderStorage.clearMemberAssignments(member.id);
      await splitFolderStorage.updateMember(member.id, { status: "removed" });
      res.json({ ok: true });
    },
  );

  // --- Accept invite (auth required) ---
  app.post(
    "/api/split-folders/invites/:token/accept",
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user!.id;
      const member = await splitFolderStorage.getMemberByToken(req.params.token);
      if (!member) return res.status(404).json({ error: "Invite not found" });
      if (member.status === "removed") {
        return res.status(410).json({ error: "Invite revoked" });
      }
      if (!member.userId) {
        await splitFolderStorage.updateMember(member.id, {
          userId,
          status: "active",
          joinedAt: new Date(),
        });
      } else if (member.userId !== userId) {
        return res.status(403).json({ error: "This invite belongs to another account" });
      } else if (member.status !== "active") {
        await splitFolderStorage.updateMember(member.id, { status: "active", joinedAt: new Date() });
      }
      res.json({ folderId: member.folderId });
    },
  );

  // --- Public invite preview (no auth) for the join page ---
  app.get("/api/split-folders/invites/:token", async (req, res: Response) => {
    const member = await splitFolderStorage.getMemberByToken(req.params.token);
    if (!member || member.status === "removed") {
      return res.status(404).json({ error: "Invite not found" });
    }
    const folder = await splitFolderStorage.getFolder(member.folderId);
    if (!folder) return res.status(404).json({ error: "Invite not found" });
    res.json({
      folderName: folder.name,
      folderDescription: folder.description,
      alreadyActive: member.status === "active",
    });
  });

  // --- Set split mode + assignments for a receipt in a folder ---
  app.put(
    "/api/split-folders/:id/receipts/:receiptId/assignments",
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user!.id;
        const folder = await loadFolderForUser(req.params.id, userId);
        if (!folder) return res.status(404).json({ error: "Folder not found" });
        const receipt = await storage.getReceipt(req.params.receiptId);
        if (!receipt || receipt.splitFolderId !== folder.id) {
          return res.status(404).json({ error: "Receipt not in folder" });
        }
        if (receipt.userId !== userId && folder.ownerId !== userId) {
          return res.status(403).json({ error: "Only the receipt owner or folder owner can edit assignments" });
        }
        const body = setAssignmentsBody.parse(req.body);

        // Validate per-mode so unassigned items or items left out don't break the save.
        const tolerance = Math.max(0.05, body.assignments.length * 0.01);
        if (body.mode === "whole") {
          const sum = body.assignments.reduce((s, a) => s + parseFloat(a.shareAmount || "0"), 0);
          const receiptTotal = totalInGBP(receipt);
          if (body.assignments.length > 0 && Math.abs(sum - receiptTotal) > tolerance) {
            return res.status(400).json({
              error: `Assignment total £${sum.toFixed(2)} doesn't match receipt total £${receiptTotal.toFixed(2)}`,
            });
          }
        } else if (body.mode === "items") {
          const receiptItems = await storage.getReceiptItems(receipt.id);
          const byItem = new Map<string, number>();
          for (const a of body.assignments) {
            byItem.set(a.itemId || "", (byItem.get(a.itemId || "") || 0) + parseFloat(a.shareAmount || "0"));
          }
          for (const item of receiptItems) {
            const itemTotal = itemPriceInGBP(item, receipt);
            const assigned = byItem.get(item.id) || 0;
            if (assigned > 0 && Math.abs(assigned - itemTotal) > tolerance) {
              return res.status(400).json({
                error: `Item "${item.name}" shares (£${assigned.toFixed(2)}) don't add up to its price (£${itemTotal.toFixed(2)})`,
              });
            }
          }
        }

        // Make sure every memberId actually belongs to this folder.
        const memberIds = new Set(body.assignments.map((a) => a.memberId));
        if (memberIds.size > 0) {
          const folderMembers = await splitFolderStorage.listMembers(folder.id);
          const validIds = new Set(folderMembers.map((m) => m.id));
          for (const id of Array.from(memberIds)) {
            if (!validIds.has(id)) {
              return res.status(400).json({ error: "Invalid member references" });
            }
          }
        }

        const rows = await splitFolderStorage.replaceReceiptAssignments(
          folder.id,
          receipt.id,
          body.assignments.map((a) => ({
            folderId: folder.id,
            receiptId: receipt.id,
            memberId: a.memberId,
            itemId: a.itemId || null,
            shareAmount: a.shareAmount,
            status: "pending",
          })),
        );
        res.json({ assignments: rows, mode: body.mode });
      } catch (err: any) {
        res.status(400).json({ error: err?.message || "Failed to save assignments" });
      }
    },
  );

  // --- Mark a member's outstanding assignments as paid (owner only) ---
  app.post(
    "/api/split-folders/:id/members/:memberId/settle",
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user!.id;
      const folder = await loadFolderForUser(req.params.id, userId);
      if (!folder) return res.status(404).json({ error: "Folder not found" });
      if (folder.ownerId !== userId) {
        return res.status(403).json({ error: "Only the folder owner can mark settlement" });
      }
      const member = await splitFolderStorage.getMember(req.params.memberId);
      if (!member || member.folderId !== folder.id) {
        return res.status(404).json({ error: "Member not found" });
      }
      await splitFolderStorage.markMemberSettled(folder.id, member.id);
      res.json({ ok: true });
    },
  );
}
