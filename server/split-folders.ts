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
import { allocationSummary, billStatus, calculateSplitBalances, canSplit, canUpdateBillParticipantStatus, money, normalizeSplitRole, validateAllocations } from "./split-utils";

function newToken() {
  return randomBytes(24).toString("base64url");
}

function num(n: string | number | null | undefined): number {
  if (n === null || n === undefined) return 0;
  return typeof n === "number" ? n : parseFloat(n);
}

function splitEvenly(amount: number, count: number): string[] {
  if (count <= 0) return [];
  const totalCents = Math.round(amount * 100);
  const baseCents = Math.floor(totalCents / count);
  const remainder = totalCents - baseCents * count;
  return Array.from({ length: count }, (_, index) =>
    ((baseCents + (index < remainder ? 1 : 0)) / 100).toFixed(2),
  );
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

async function folderPermission(folder: SplitFolder, userId: string) {
  if (folder.ownerId === userId) return "owner" as const;
  const member = (await splitFolderStorage.listMembers(folder.id)).find(
    (m) => m.userId === userId && m.status === "active",
  );
  return member ? normalizeSplitRole(member.role) : null;
}

async function requireFolderPermission(
  folder: SplitFolder,
  userId: string,
  permission: "read" | "add" | "edit" | "manage",
  res: Response,
) {
  const role = await folderPermission(folder, userId);
  if (!role || !canSplit(role, permission)) {
    res.status(403).json({ error: `Your folder role does not permit this action` });
    return null;
  }
  return role;
}

// inviteToken is a secret used as the join URL; never leak it in list/detail responses.
// (The token is returned once at invite-creation time so the owner can share the link.)
function sanitizeMember(m: SplitFolderMember) {
  const { inviteToken, ...safe } = m;
  return safe;
}

async function buildFolderSummary(folder: SplitFolder) {
  const [members, folderReceipts, assignments, bills, manualExpenses] = await Promise.all([
    splitFolderStorage.listMembers(folder.id),
    splitFolderStorage.listFolderReceipts(folder.id),
    splitFolderStorage.listAssignments(folder.id),
    splitFolderStorage.listBills(folder.id),
    splitFolderStorage.listManualExpenses(folder.id),
  ]);
  const balance = calculateSplitBalances({
    members,
    receipts: folderReceipts,
    expenses: manualExpenses,
    assignments,
    bills,
  });
  return {
    ...folder,
    ...balance,
    totalAmount: balance.totalSpent,
    sharedAmount: balance.allocatedAmount,
    memberCount: members.filter((m) => m.status !== "removed").length,
    members: members.filter((m) => m.status !== "removed").map(sanitizeMember),
    status: balance.outstandingAmount === 0 ? "settled" : "pending",
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
  emailSender: typeof sendEmail = sendEmail,
) {
  const link = `${origin}/split/invite/${inviteToken}`;
  const folderReceipts = await splitFolderStorage.listFolderReceipts(folder.id);
  const receiptsForEmail = folderReceipts.map((r) => ({
    merchantName: r.merchantName,
    total: totalInGBP(r),
    date: r.date,
  }));
  const { text, html } = inviteEmailBody(folder.name, inviterName, link, receiptsForEmail);
  return emailSender({
    to: toEmail,
    subject: `${inviterName} invited you to split a Receiptify folder`,
    text,
    html,
  });
}

export function registerSplitFolderRoutes(
  app: Express,
  dependencies: { sendEmail?: typeof sendEmail } = {},
) {
  const emailSender = dependencies.sendEmail ?? sendEmail;
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
      await splitFolderStorage.createActivity({ folderId: folder.id, actorUserId: userId, eventType: "folder.created" });
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

    const [members, folderReceipts, assignments, bills] = await Promise.all([
      splitFolderStorage.listMembers(folder.id),
      splitFolderStorage.listFolderReceipts(folder.id),
      splitFolderStorage.listAssignments(folder.id),
      splitFolderStorage.listBills(folder.id),
    ]);
    const manualExpenses = await splitFolderStorage.listManualExpenses(folder.id);
    const [subfolders, receiptMetadata] = await Promise.all([
      splitFolderStorage.listSubfolders(folder.id),
      splitFolderStorage.listReceiptMetadata(folder.id),
    ]);
    const currentRole = await folderPermission(folder, userId);
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

    const balance = calculateSplitBalances({
      members,
      receipts: folderReceipts,
      expenses: manualExpenses,
      assignments,
      bills,
    });

    // Per-member settlement is always computed, never stored.
    const settlement = members
      .filter((m) => m.status !== "removed")
      .map((m) => {
        const memberBalance = balance.memberBalances.find((entry) => entry.memberId === m.id)!;
        return {
          memberId: m.id,
          displayName: m.displayName,
          userId: m.userId,
          inviteEmail: m.inviteEmail,
          role: m.role,
          allocated: memberBalance.allocatedAmount,
          owed: memberBalance.outstandingAmount,
          paid: memberBalance.paidAmount,
          total: memberBalance.allocatedAmount,
          paidUpfront: memberBalance.paidUpfrontAmount,
          personal: memberBalance.personalAmount,
          recoverable: memberBalance.recoverableAmount,
          recovered: memberBalance.recoveredAmount,
          outstandingToReceive: memberBalance.outstandingToReceive,
          status: memberBalance.outstandingAmount === 0 ? "settled" : "pending",
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
          rawPrice: item.price,
          price: String(itemPriceInGBP(item, r)),
        })),
        assignments: assignmentsByReceipt.get(r.id) || [],
        splitMetadata: receiptMetadata.find((metadata) => metadata.receiptId === r.id) ?? null,
      })),
      settlement,
      manualExpenses: manualExpenses.map((expense) => ({
        ...expense,
        allocations: assignments.filter((assignment) => assignment.sourceType === "expense" && assignment.sourceId === expense.id),
      })),
      subfolders,
      balance,
      totalSpent: balance.totalSpent,
      allocatedAmount: balance.allocatedAmount,
      sharedAmount: balance.allocatedAmount,
      paidAmount: balance.paidAmount,
      outstandingAmount: balance.outstandingAmount,
      personalAmount: balance.personalAmount,
      receiptCount: balance.receiptCount,
      // Compatibility alias for existing clients; this now means source spend.
      totalAmount: balance.totalSpent,
      isOwner: folder.ownerId === userId,
      currentMemberId: members.find((member) => member.userId === userId && member.status === "active")?.id ?? null,
      currentRole,
      permissions: {
        read: !!currentRole && canSplit(currentRole, "read"),
        add: !!currentRole && canSplit(currentRole, "add"),
        edit: !!currentRole && canSplit(currentRole, "edit"),
        manage: !!currentRole && canSplit(currentRole, "manage"),
      },
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
      if (!(await requireFolderPermission(folder, userId, "add", res))) return;
      const receiptId = z.string().parse(req.body?.receiptId);
      const receipt = await storage.getReceipt(receiptId);
      if (!receipt || receipt.userId !== userId) {
        return res.status(404).json({ error: "Receipt not found" });
      }
      if (receipt.splitFolderId && receipt.splitFolderId !== folder.id) {
        const oldAssignments = await splitFolderStorage.listAssignments(receipt.splitFolderId);
        if (oldAssignments.some((assignment) => assignment.receiptId === receiptId && assignment.status === "paid")) {
          return res.status(409).json({ error: "Mark paid assignments as unpaid before moving this receipt" });
        }
        const cleared = await splitFolderStorage.clearReceiptAssignments(receipt.splitFolderId, receiptId);
        if (!cleared) {
          return res.status(409).json({ error: "Mark paid assignments as unpaid before moving this receipt" });
        }
      }
      const updated = await splitFolderStorage.attachReceipt(receiptId, folder.id);
      await splitFolderStorage.createActivity({ folderId: folder.id, actorUserId: userId, eventType: "receipt.attached", metadata: { receiptId } });
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
      if (!(await requireFolderPermission(folder, userId, "edit", res))) return;
      const assignments = await splitFolderStorage.listAssignments(folder.id);
      if (assignments.some((assignment) => assignment.receiptId === receipt.id && assignment.status === "paid")) {
        return res.status(409).json({ error: "Mark paid assignments as unpaid before removing this receipt" });
      }
      const cleared = await splitFolderStorage.clearReceiptAssignments(folder.id, receipt.id);
      if (!cleared) {
        return res.status(409).json({ error: "Mark paid assignments as unpaid before removing this receipt" });
      }
      await splitFolderStorage.detachReceipt(receipt.id, folder.id);
      res.json({ ok: true });
    },
  );

  // --- Delete folder (owner only) — notifies members by email ---
  app.delete(
    "/api/split-folders/:id",
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user!.id;
      const folder = await splitFolderStorage.getFolder(req.params.id);
      if (!folder) return res.status(404).json({ error: "Folder not found" });
      if (folder.ownerId !== userId) {
        return res.status(403).json({ error: "Only the folder owner can delete this folder" });
      }

      // Collect member emails BEFORE deleting — the member rows go away with the folder.
      const members = await splitFolderStorage.listMembers(folder.id);
      const emails = new Set<string>();
      for (const m of members) {
        if (m.role === "owner" || m.status === "removed") continue;
        if (m.inviteEmail) {
          emails.add(m.inviteEmail.toLowerCase());
        } else if (m.userId) {
          // Member userIds are normally Firebase UIDs, but legacy rows may hold DB UUIDs.
          const u =
            (await storage.getUserByProviderId("firebase", m.userId)) ||
            (await storage.getUser(m.userId));
          if (u?.email) emails.add(u.email.toLowerCase());
        }
      }

      const deleted = await splitFolderStorage.deleteFolderIfUnsettled(folder.id);
      if (!deleted) {
        return res.status(409).json({
          error: "Mark all paid receipt, expense, and bill shares as unpaid before deleting this folder",
        });
      }
      res.json({ ok: true });

      // Notify members after responding — email failures shouldn't block deletion.
      const ownerName = req.user!.name || req.user!.email || "The folder owner";
      const subject = `"${folder.name}" split folder was deleted`;
      const text = `${ownerName} deleted the shared split folder "${folder.name}" on Receiptify.

Any receipts shared in it have been returned to their owners' wallets, and pending split assignments in this folder have been cleared.

No action is needed from you.`;
      const html = `<p><strong>${escapeHtml(ownerName)}</strong> deleted the shared split folder <strong>"${escapeHtml(folder.name)}"</strong> on <strong>Receiptify</strong>.</p>
<p>Any receipts shared in it have been returned to their owners' wallets, and pending split assignments in this folder have been cleared.</p>
<p style="color:#666;font-size:12px">No action is needed from you.</p>`;

      const results = await Promise.allSettled(
        Array.from(emails).map((to) => emailSender({ to, subject, text, html })),
      );
      results.forEach((r, i) => {
        if (r.status === "rejected" || (r.status === "fulfilled" && !r.value.sent)) {
          const reason = r.status === "rejected" ? r.reason : r.value.reason;
          console.warn(`[folder-delete] failed to notify ${Array.from(emails)[i]}:`, reason);
        }
      });
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
        if (!(await requireFolderPermission(folder, userId, "manage", res))) return;
        const body = inviteBody.parse(req.body);

        let invitedUserId: string | null = null;
        let inviteEmail: string | null = body.email ?? null;
        let displayName = body.displayName || body.email || "Invited friend";

        if (body.email) {
          const u = await splitFolderStorage.findUserByEmail(body.email);
          if (u) {
            invitedUserId = u.providerId ?? null;
            displayName = body.displayName || [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || body.email;
          }
        }

        const member = await splitFolderStorage.createMember({
          folderId: folder.id,
          userId: invitedUserId,
          inviteEmail,
          displayName,
          inviteToken: newToken(),
          // Even existing account holders must explicitly accept the invite —
          // joining is only finalized in /invites/:token/accept.
          status: "invited",
          role: "member",
        });

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
            emailSender,
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
        emailSender,
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
      const removal = await splitFolderStorage.removeMemberFinancials(folder.id, member.id);
      if (removal.paidConflict) {
        return res.status(409).json({
          error: "Mark this member's paid receipt, expense, and bill shares as unpaid before removing them",
        });
      }
      res.json({ ok: true });
    },
  );

  // --- Accept invite (auth required) ---
  app.post(
    "/api/split-folders/invites/:token/accept",
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user!.id;
      const userEmail = req.user!.email?.toLowerCase() ?? null;
      const member = await splitFolderStorage.getMemberByToken(req.params.token);
      if (!member) return res.status(404).json({ error: "Invite not found" });
      if (member.status === "removed") {
        return res.status(410).json({ error: "Invite revoked" });
      }

      // Resolve the current user's DB record so we can match against either
      // their Firebase UID or their internal DB UUID (older invites may have
      // stored either one).
      const currentDbUser = await storage.getUserByProviderId("firebase", userId);
      const possibleIds = new Set<string>([userId]);
      if (currentDbUser?.id) possibleIds.add(currentDbUser.id);

      const inviteEmailLc = member.inviteEmail?.toLowerCase() ?? null;
      const emailMatches = !!(userEmail && inviteEmailLc && userEmail === inviteEmailLc);
      const storedIdMatches = !!(member.userId && possibleIds.has(member.userId));

      if (member.status === "active") {
        if (!storedIdMatches) {
          return res.status(403).json({ error: "This invite has already been accepted by another account" });
        }
        return res.json({ folderId: member.folderId });
      }

      if (member.userId && !emailMatches && !storedIdMatches) {
        console.warn("[invite] rejected acceptance by a non-matching account");
        return res.status(403).json({ error: "This invite belongs to another account" });
      }

      const activation = await splitFolderStorage.activateMemberIfInvited(
        member.id,
        userId,
        member.joinedAt ?? new Date(),
      );
      if (!activation) return res.status(404).json({ error: "Invite not found" });
      if (activation.member.status === "removed") {
        return res.status(410).json({ error: "Invite revoked" });
      }
      if (!activation.activated) {
        if (activation.member.userId !== userId) {
          return res.status(403).json({ error: "This invite has already been accepted by another account" });
        }
        return res.json({ folderId: activation.member.folderId });
      }

      const joinerName =
        req.user!.name ||
        activation.member.displayName ||
        req.user!.email ||
        "An invited friend";
      try {
        await splitFolderStorage.createActivity({
          folderId: activation.member.folderId,
          actorUserId: userId,
          eventType: "member.joined",
          metadata: {
            memberId: activation.member.id,
            displayName: joinerName,
          },
        });
      } catch (error) {
        console.warn("[member-joined] failed to record folder activity:", error);
      }

      try {
        const folder = await splitFolderStorage.getFolder(activation.member.folderId);
        if (folder) {
        const owner =
          (await storage.getUserByProviderId("firebase", folder.ownerId)) ||
          (await storage.getUser(folder.ownerId));
        const ownerEmail = owner?.email || folder.ownerContactEmail;
        if (
          ownerEmail &&
          ownerEmail.toLowerCase() !== req.user!.email?.toLowerCase()
        ) {
          const subject = `${joinerName} joined "${folder.name}" on Receiptify`;
          const text = `${joinerName} accepted your invitation and joined the shared split folder "${folder.name}".

Open Receiptify to view the folder.`;
          const html = `<p><strong>${escapeHtml(joinerName)}</strong> accepted your invitation and joined the shared split folder <strong>"${escapeHtml(folder.name)}"</strong>.</p>
<p>Open Receiptify to view the folder.</p>`;
          const result = await emailSender({
            to: ownerEmail,
            subject,
            text,
            html,
          });
          if (!result.sent) {
            console.warn(
              "[member-joined] owner notification was not delivered:",
              result.reason,
            );
          }
        }
      }
      } catch (error) {
        console.warn("[member-joined] failed to notify folder owner:", error);
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
        if (!(await requireFolderPermission(folder, userId, "edit", res))) return;
        const body = setAssignmentsBody.parse(req.body);

        // Partial allocation is intentional: the remainder is personal/ignored
        // and never becomes folder outstanding.
        if (body.mode === "whole") {
          if (body.assignments.some((assignment) => assignment.itemId)) {
            return res.status(400).json({ error: "Whole-receipt assignments cannot reference receipt items" });
          }
          const receiptTotal = totalInGBP(receipt);
          const issue = validateAllocations(receiptTotal, body.assignments);
          if (issue) {
            return res.status(400).json({
              error: issue,
            });
          }
        } else if (body.mode === "items") {
          const receiptItems = await storage.getReceiptItems(receipt.id);
          const validItemIds = new Set(receiptItems.map((item) => item.id));
          const unknownItem = body.assignments.find((assignment) => assignment.itemId && !validItemIds.has(assignment.itemId));
          if (unknownItem) {
            return res.status(400).json({ error: "Invalid receipt item reference" });
          }
          const byItem = new Map<string, number>();
          for (const a of body.assignments) {
            byItem.set(a.itemId || "", (byItem.get(a.itemId || "") || 0) + parseFloat(a.shareAmount || "0"));
          }
          for (const item of receiptItems) {
            const itemTotal = itemPriceInGBP(item, receipt);
            const assigned = byItem.get(item.id) || 0;
            const issue = validateAllocations(itemTotal, body.assignments.filter((a) => a.itemId === item.id));
            if (issue) {
              return res.status(400).json({
                error: `Item "${item.name}": ${issue}`,
              });
            }
          }
          const receiptTotal = totalInGBP(receipt);
          const itemSubtotal = receiptItems.reduce((sum, item) => sum + itemPriceInGBP(item, receipt), 0);
          const additionalCharges = money(Math.max(0, receiptTotal - itemSubtotal));
          const additionalIssue = validateAllocations(
            additionalCharges,
            body.assignments.filter((assignment) => !assignment.itemId),
          );
          if (additionalIssue) {
            return res.status(400).json({ error: `Additional charges: ${additionalIssue}` });
          }
        }

        // Make sure every memberId actually belongs to this folder.
        const memberIds = new Set(body.assignments.map((a) => a.memberId));
        if (memberIds.size > 0) {
          const folderMembers = await splitFolderStorage.listMembers(folder.id);
          const validIds = new Set(folderMembers.filter((member) => member.status !== "removed").map((m) => m.id));
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
        await splitFolderStorage.createActivity({ folderId: folder.id, actorUserId: userId, eventType: "receipt.assignments_updated", metadata: { receiptId: receipt.id } });
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
      if (!member || member.folderId !== folder.id || member.status === "removed") {
        return res.status(404).json({ error: "Member not found" });
      }
      const settled = await splitFolderStorage.markMemberSettled(folder.id, member.id);
      if (!settled) {
        return res.status(409).json({ error: "This member was removed before settlement completed" });
      }
      await splitFolderStorage.createActivity({ folderId: folder.id, actorUserId: userId, eventType: "member.settled", metadata: { memberId: member.id } });
      res.json({ ok: true });
    },
  );

  // --- Revert a member's paid assignments back to pending (owner only) ---
  app.post(
    "/api/split-folders/:id/members/:memberId/unsettle",
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user!.id;
      const folder = await loadFolderForUser(req.params.id, userId);
      if (!folder) return res.status(404).json({ error: "Folder not found" });
      if (folder.ownerId !== userId) {
        return res.status(403).json({ error: "Only the folder owner can mark settlement" });
      }
      const member = await splitFolderStorage.getMember(req.params.memberId);
      if (!member || member.folderId !== folder.id || member.status === "removed") {
        return res.status(404).json({ error: "Member not found" });
      }
      const reverted = await splitFolderStorage.markMemberUnsettled(folder.id, member.id);
      if (reverted === 0) {
        return res.status(409).json({ error: "This member has no settled shares to revert" });
      }
      await splitFolderStorage.createActivity({ folderId: folder.id, actorUserId: userId, eventType: "member.unsettled", metadata: { memberId: member.id } });
      res.json({ ok: true });
    },
  );

  // Folder metadata, contact details, and first-level/subfolder relationship.
  app.patch("/api/split-folders/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    const folder = await splitFolderStorage.getFolder(req.params.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    if (!(await requireFolderPermission(folder, req.user!.id, "manage", res))) return;
    const body = z.object({
      name: z.string().trim().min(1).optional(), description: z.string().nullable().optional(),
      ownerContactName: z.string().nullable().optional(), ownerContactEmail: z.string().email().nullable().optional(),
      ownerContactPhone: z.string().nullable().optional(), parentFolderId: z.string().nullable().optional(),
    }).parse(req.body);
    if (body.parentFolderId === folder.id) return res.status(400).json({ error: "A folder cannot be its own parent" });
    const updated = await splitFolderStorage.updateFolder(folder.id, body);
    await splitFolderStorage.createActivity({ folderId: folder.id, actorUserId: req.user!.id, eventType: "folder.updated", metadata: Object.keys(body) });
    res.json(updated);
  });

  app.patch("/api/split-folders/:id/members/:memberId/role", requireAuth, async (req: AuthenticatedRequest, res) => {
    const folder = await splitFolderStorage.getFolder(req.params.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    if (!(await requireFolderPermission(folder, req.user!.id, "manage", res))) return;
    const role = z.enum(["viewer", "contributor", "editor"]).parse(req.body?.role);
    const member = await splitFolderStorage.getMember(req.params.memberId);
    if (!member || member.folderId !== folder.id || member.role === "owner") return res.status(404).json({ error: "Member not found" });
    res.json(sanitizeMember((await splitFolderStorage.updateMember(member.id, { role }))!));
  });

  app.get("/api/split-folders/:id/activity", requireAuth, async (req: AuthenticatedRequest, res) => {
    const folder = await loadFolderForUser(req.params.id, req.user!.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    res.json(await splitFolderStorage.listActivity(folder.id));
  });

  app.post("/api/split-folders/:id/expenses", requireAuth, async (req: AuthenticatedRequest, res) => {
    const folder = await loadFolderForUser(req.params.id, req.user!.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    if (!(await requireFolderPermission(folder, req.user!.id, "add", res))) return;
    const body = z.object({ description: z.string().trim().min(1), amount: z.union([z.string(), z.number()]), notes: z.string().optional(), expenseDate: z.coerce.date().optional(), payerMemberId: z.string().optional(), subfolderId: z.string().nullable().optional(), allocations: z.array(assignmentInput).optional() }).parse(req.body);
    if (money(body.amount) <= 0) return res.status(400).json({ error: "Amount must be positive" });
    const members = await splitFolderStorage.listMembers(folder.id);
    if (
      (body.payerMemberId && !members.some((m) => m.id === body.payerMemberId && m.status === "active")) ||
      body.allocations?.some((a) => !members.some((m) => m.id === a.memberId && m.status !== "removed"))
    ) return res.status(400).json({ error: "Invalid expense member reference" });
    if (body.subfolderId && !(await splitFolderStorage.listSubfolders(folder.id)).some((s) => s.id === body.subfolderId)) return res.status(400).json({ error: "Invalid subfolder" });
    const issue = validateAllocations(body.amount, body.allocations || []);
    if (issue) return res.status(400).json({ error: issue });
    const { allocations = [], ...expenseInput } = body;
    const expense = await splitFolderStorage.createManualExpense({ ...expenseInput, amount: money(body.amount).toFixed(2), folderId: folder.id, createdBy: req.user!.id, currency: "GBP" });
    if (allocations.length) await splitFolderStorage.replaceReceiptAssignments(folder.id, expense.id, allocations.map((a) => ({ folderId: folder.id, receiptId: expense.id, sourceType: "expense", sourceId: expense.id, memberId: a.memberId, itemId: null, shareAmount: money(a.shareAmount).toFixed(2), status: "pending" })));
    await splitFolderStorage.createActivity({ folderId: folder.id, actorUserId: req.user!.id, eventType: "expense.created", metadata: { expenseId: expense.id } });
    res.status(201).json(expense);
  });

  app.patch("/api/split-folders/:id/expenses/:expenseId", requireAuth, async (req: AuthenticatedRequest, res) => {
    const folder = await loadFolderForUser(req.params.id, req.user!.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    if (!(await requireFolderPermission(folder, req.user!.id, "edit", res))) return;
    const expense = (await splitFolderStorage.listManualExpenses(folder.id)).find((e) => e.id === req.params.expenseId);
    if (!expense) return res.status(404).json({ error: "Expense not found" });
    const body = z.object({ description: z.string().trim().min(1).optional(), amount: z.union([z.string(), z.number()]).optional(), notes: z.string().nullable().optional(), expenseDate: z.coerce.date().optional(), payerMemberId: z.string().nullable().optional(), subfolderId: z.string().nullable().optional(), allocations: z.array(assignmentInput).optional() }).parse(req.body);
    if (body.amount !== undefined && money(body.amount) <= 0) return res.status(400).json({ error: "Amount must be positive" });
    const members = await splitFolderStorage.listMembers(folder.id);
    if (
      (body.payerMemberId && !members.some((member) => member.id === body.payerMemberId && member.status === "active")) ||
      body.allocations?.some((allocation) => !members.some((member) => member.id === allocation.memberId && member.status !== "removed"))
    ) {
      return res.status(400).json({ error: "Invalid expense member reference" });
    }
    if (
      body.subfolderId &&
      !(await splitFolderStorage.listSubfolders(folder.id)).some((subfolder) => subfolder.id === body.subfolderId)
    ) {
      return res.status(400).json({ error: "Invalid subfolder" });
    }
    const targetAmount = body.amount === undefined ? expense.amount : body.amount;
    const issue = validateAllocations(targetAmount, body.allocations || (await splitFolderStorage.listAssignments(folder.id)).filter((a) => a.sourceType === "expense" && a.sourceId === expense.id));
    if (issue) return res.status(400).json({ error: issue });
    if (body.allocations) await splitFolderStorage.replaceReceiptAssignments(folder.id, expense.id, body.allocations.map((a) => ({ folderId: folder.id, receiptId: expense.id, sourceType: "expense", sourceId: expense.id, memberId: a.memberId, itemId: null, shareAmount: money(a.shareAmount).toFixed(2), status: "pending" })));
    const { allocations, ...updates } = body;
    res.json(await splitFolderStorage.updateManualExpense(expense.id, { ...updates, amount: body.amount === undefined ? undefined : money(body.amount).toFixed(2) }));
  });

  app.delete("/api/split-folders/:id/expenses/:expenseId", requireAuth, async (req: AuthenticatedRequest, res) => {
    const folder = await loadFolderForUser(req.params.id, req.user!.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    if (!(await requireFolderPermission(folder, req.user!.id, "edit", res))) return;
    const expense = (await splitFolderStorage.listManualExpenses(folder.id)).find((row) => row.id === req.params.expenseId);
    if (!expense) return res.status(404).json({ error: "Expense not found" });
    const expenseAssignments = await splitFolderStorage.listAssignments(folder.id);
    if (expenseAssignments.some((assignment) => assignment.sourceType === "expense" && assignment.sourceId === expense.id && assignment.status === "paid")) {
      return res.status(409).json({ error: "Mark paid assignments as unpaid before deleting this expense" });
    }
    const deleted = await splitFolderStorage.deleteManualExpense(folder.id, expense.id);
    if (!deleted) {
      return res.status(409).json({ error: "Mark paid assignments as unpaid before deleting this expense" });
    }
    res.json({ ok: true });
  });

  app.get("/api/split-folders/:id/bills", requireAuth, async (req: AuthenticatedRequest, res) => {
    const folder = await loadFolderForUser(req.params.id, req.user!.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    res.json(await splitFolderStorage.listBills(folder.id));
  });
  app.post("/api/split-folders/:id/bills", requireAuth, async (req: AuthenticatedRequest, res) => {
    const folder = await loadFolderForUser(req.params.id, req.user!.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    if (!(await requireFolderPermission(folder, req.user!.id, "edit", res))) return;
    const body = z.object({
      title: z.string().trim().min(1),
      description: z.string().optional(),
      amount: z.union([z.string(), z.number()]),
      splitMode: z.enum(["equal", "custom", "items"]),
      subfolderId: z.string().nullable().optional(),
      participants: z.array(z.object({
        memberId: z.string(),
        shareAmount: z.union([z.string(), z.number()]).optional(),
      })).default([]),
      items: z.array(z.object({
        key: z.string().min(1),
        label: z.string().trim().min(1),
        amount: z.union([z.string(), z.number()]),
        memberIds: z.array(z.string()).min(1),
      })).optional(),
    }).parse(req.body);
    const members = await splitFolderStorage.listMembers(folder.id);
    const allocatableMemberIds = new Set(members.filter((member) => member.status !== "removed").map((member) => member.id));
    if (body.subfolderId && !(await splitFolderStorage.listSubfolders(folder.id)).some((subfolder) => subfolder.id === body.subfolderId)) {
      return res.status(400).json({ error: "Invalid subfolder" });
    }
    if (body.participants.some((participant) => !allocatableMemberIds.has(participant.memberId))) {
      return res.status(400).json({ error: "Invalid bill participant" });
    }
    const total = money(body.amount);
    if (total <= 0) return res.status(400).json({ error: "Amount must be positive" });

    const billItems: Array<{ billId: string; itemKey: string; label: string; amount: string }> = [];
    const participantRows: Array<{ billId: string; memberId: string; itemId: string | null; shareAmount: string; status: string }> = [];

    if (body.splitMode === "items") {
      const items = body.items || [];
      if (!items.length) return res.status(400).json({ error: "Item-level bills need at least one item" });
      if (new Set(items.map((item) => item.key)).size !== items.length) {
        return res.status(400).json({ error: "Bill item keys must be unique" });
      }
      const itemTotal = items.reduce((sum, item) => sum + money(item.amount), 0);
      if (Math.abs(itemTotal - total) > 0.01) {
        return res.status(400).json({ error: `Items add up to £${itemTotal.toFixed(2)}, but the bill is £${total.toFixed(2)}` });
      }
      for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
        const item = items[itemIndex];
        if (money(item.amount) < 0) return res.status(400).json({ error: "Item amounts must be non-negative" });
        if (item.memberIds.some((memberId: string) => !allocatableMemberIds.has(memberId))) {
          return res.status(400).json({ error: "Invalid member assigned to a bill item" });
        }
        billItems.push({ billId: "", itemKey: item.key, label: item.label, amount: money(item.amount).toFixed(2) });
        const shares = splitEvenly(money(item.amount), item.memberIds.length);
        item.memberIds.forEach((memberId: string, memberIndex: number) => {
          participantRows.push({
            billId: "",
            memberId,
            itemId: String(itemIndex),
            shareAmount: shares[memberIndex],
            status: "pending",
          });
        });
      }
    } else {
      if (!body.participants.length) return res.status(400).json({ error: "Choose at least one participant" });
      const shares = body.splitMode === "equal"
        ? splitEvenly(total, body.participants.length)
        : body.participants.map((participant) => money(participant.shareAmount).toFixed(2));
      const normalized = body.participants.map((participant, index) => ({
        memberId: participant.memberId,
        shareAmount: shares[index],
      }));
      const issue = validateAllocations(total, normalized);
      if (issue || allocationSummary(total, normalized).personal !== 0) {
        return res.status(400).json({ error: issue || "Bill shares must equal its amount" });
      }
      normalized.forEach((participant) => {
        participantRows.push({
          billId: "",
          memberId: participant.memberId,
          itemId: null,
          shareAmount: participant.shareAmount,
          status: "pending",
        });
      });
    }

    const bill = await splitFolderStorage.createBill(
      {
        folderId: folder.id,
        subfolderId: body.subfolderId ?? null,
        createdBy: req.user!.id,
        title: body.title,
        description: body.description,
        amount: total.toFixed(2),
        currency: "GBP",
        splitMode: body.splitMode,
        status: "unpaid",
      },
      participantRows,
      billItems,
    );
    await splitFolderStorage.createActivity({
      folderId: folder.id,
      subfolderId: body.subfolderId ?? null,
      actorUserId: req.user!.id,
      eventType: "bill.created",
      metadata: { billId: bill.id, splitMode: body.splitMode },
    });
    const expanded = (await splitFolderStorage.listBills(folder.id)).find((row) => row.id === bill.id);
    res.status(201).json(expanded ?? bill);
  });
  app.patch("/api/split-folders/:id/bills/:billId/participants/:participantId", requireAuth, async (req: AuthenticatedRequest, res) => {
    const folder = await loadFolderForUser(req.params.id, req.user!.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    const role = await folderPermission(folder, req.user!.id);
    const bill = (await splitFolderStorage.listBills(folder.id)).find((b) => b.id === req.params.billId);
    const participant = bill?.participants.find((p) => p.id === req.params.participantId);
    if (!bill || !participant) return res.status(404).json({ error: "Bill participant not found" });
    const nextStatus = z.enum(["pending", "paid", "declined"]).parse(req.body?.status);
    const participantMember = participant.memberId
      ? await splitFolderStorage.getMember(participant.memberId)
      : undefined;
    const permitted = canUpdateBillParticipantStatus({
      isManager: canSplit(role, "manage"),
      isSelf: participantMember?.userId === req.user!.id,
      currentStatus: participant.status,
      nextStatus,
    });
    if (!permitted) return res.status(403).json({ error: "Only the folder owner can mark bill shares paid or pending" });
    const updated = await splitFolderStorage.updateBillParticipant(
      participant.id,
      nextStatus,
      participant.status || "pending",
    );
    if (!updated) {
      return res.status(409).json({ error: "This member was removed before the payment status changed" });
    }
    const all = await splitFolderStorage.listBills(folder.id); const current = all.find((b) => b.id === bill.id)!;
    const status = billStatus(current.participants.map((p) => p.id === participant.id ? { ...p, status: updated.status } : p));
    await splitFolderStorage.updateBillStatus(bill.id, status);
    res.json({ participant: updated, status });
  });

  app.get("/api/split-folders/:id/payment-requests", requireAuth, async (req: AuthenticatedRequest, res) => {
    const folder = await loadFolderForUser(req.params.id, req.user!.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    res.json(await splitFolderStorage.listPaymentRequests(folder.id));
  });
  app.post("/api/split-folders/:id/payment-requests", requireAuth, async (req: AuthenticatedRequest, res) => {
    const folder = await splitFolderStorage.getFolder(req.params.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    if (!(await requireFolderPermission(folder, req.user!.id, "manage", res))) return;
    const body = z.object({
      memberId: z.string(),
      amount: z.union([z.string(), z.number()]),
      currency: z.string().length(3).optional(),
      context: z.string().trim().max(160).optional(),
      message: z.string().trim().max(1000).optional(),
      subfolderId: z.string().optional(),
    }).parse(req.body);
    if (money(body.amount) <= 0) return res.status(400).json({ error: "Amount must be positive" });
    const member = await splitFolderStorage.getMember(body.memberId);
    if (!member || member.folderId !== folder.id || member.status === "removed") {
      return res.status(400).json({ error: "Invalid member" });
    }
    if (body.subfolderId) {
      const subfolder = (await splitFolderStorage.listSubfolders(folder.id))
        .find((candidate) => candidate.id === body.subfolderId);
      if (!subfolder || subfolder.folderId !== folder.id) {
        return res.status(400).json({ error: "Invalid subfolder" });
      }
    }
    const request = await splitFolderStorage.createPaymentRequest({
      folderId: folder.id,
      requestedBy: req.user!.id,
      memberId: member.id,
      subfolderId: body.subfolderId || null,
      amount: money(body.amount).toFixed(2),
      currency: (body.currency || "GBP").toUpperCase(),
      context: body.context || null,
      message: body.message || null,
      status: "draft",
    });
    await splitFolderStorage.createPaymentEvent({ paymentRequestId: request.id, eventType: "created" });
    res.status(201).json(request);
  });
  app.post("/api/split-folders/:id/payment-requests/:requestId/send", requireAuth, async (req: AuthenticatedRequest, res) => {
    const folder = await splitFolderStorage.getFolder(req.params.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    if (!(await requireFolderPermission(folder, req.user!.id, "manage", res))) return;
    const request = (await splitFolderStorage.listPaymentRequests(folder.id)).find((r) => r.id === req.params.requestId);
    if (!request) return res.status(404).json({ error: "Payment request not found" });
    // This is deliberately only a Connect-ready boundary. No URL or success is
    // fabricated; Receiptify never takes custody of a member's funds.
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: "Stripe Connect is not configured", code: "stripe_unavailable", status: request.status });
    }
    return res.status(501).json({ error: "Stripe Connect payment creation is not configured", code: "stripe_unavailable" });
  });
  app.post("/api/split-folders/:id/payment-requests/:requestId/cancel", requireAuth, async (req: AuthenticatedRequest, res) => {
    const folder = await splitFolderStorage.getFolder(req.params.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    if (!(await requireFolderPermission(folder, req.user!.id, "manage", res))) return;
    const request = (await splitFolderStorage.listPaymentRequests(folder.id)).find((r) => r.id === req.params.requestId);
    if (!request) return res.status(404).json({ error: "Payment request not found" });
    if (request.status !== "draft" && request.status !== "pending") return res.status(409).json({ error: "Payment request cannot be cancelled" });
    const updated = await splitFolderStorage.updatePaymentRequest(request.id, { status: "cancelled" });
    await splitFolderStorage.createPaymentEvent({ paymentRequestId: request.id, eventType: "cancelled" }); res.json(updated);
  });
  app.post("/api/split-folders/:id/payment-requests/:requestId/decline", requireAuth, async (req: AuthenticatedRequest, res) => {
    const folder = await loadFolderForUser(req.params.id, req.user!.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    const request = (await splitFolderStorage.listPaymentRequests(folder.id)).find((r) => r.id === req.params.requestId);
    const member = request && await splitFolderStorage.getMember(request.memberId);
    if (!request || !member) return res.status(404).json({ error: "Payment request not found" });
    if (member.userId !== req.user!.id) return res.status(403).json({ error: "Only the recipient can decline" });
    if (request.status !== "pending") return res.status(409).json({ error: "Only pending requests can be declined" });
    const updated = await splitFolderStorage.updatePaymentRequest(request.id, { status: "declined" });
    await splitFolderStorage.createPaymentEvent({ paymentRequestId: request.id, eventType: "declined" }); res.json(updated);
  });

  // Item editing in the Split workspace: editors may curate an attached
  // receipt; contributors/viewers cannot alter another member's source facts.
  app.post("/api/split-folders/:id/receipts/:receiptId/items", requireAuth, async (req: AuthenticatedRequest, res) => {
    const folder = await loadFolderForUser(req.params.id, req.user!.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    if (!(await requireFolderPermission(folder, req.user!.id, "edit", res))) return;
    const receipt = await storage.getReceipt(req.params.receiptId);
    if (!receipt || receipt.splitFolderId !== folder.id) return res.status(404).json({ error: "Receipt not in folder" });
    const body = z.object({ name: z.string().trim().min(1), price: z.union([z.string(), z.number()]), quantity: z.union([z.string(), z.number()]).optional(), category: z.string().optional(), notes: z.string().optional() }).parse(req.body);
    const itemPrice = Number(body.price);
    if (!Number.isFinite(itemPrice) || itemPrice < 0) {
      return res.status(400).json({ error: "Price must be a finite non-negative amount" });
    }
    const result = await splitFolderStorage.createReceiptItemIfUnsettled(folder.id, receipt.id, {
      ...body,
      receiptId: receipt.id,
      price: money(itemPrice).toFixed(2),
      quantity: body.quantity === undefined ? "1" : String(body.quantity),
    });
    if (result.status === "paidConflict") {
      return res.status(409).json({ error: "Mark this receipt's paid shares as unpaid before editing its items" });
    }
    if (result.status === "notFound") return res.status(404).json({ error: "Receipt not in folder" });
    res.status(201).json(result.item);
  });
  app.patch("/api/split-folders/:id/receipts/:receiptId/items/:itemId", requireAuth, async (req: AuthenticatedRequest, res) => {
    const folder = await loadFolderForUser(req.params.id, req.user!.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    if (!(await requireFolderPermission(folder, req.user!.id, "edit", res))) return;
    const receipt = await storage.getReceipt(req.params.receiptId);
    if (!receipt || receipt.splitFolderId !== folder.id) {
      return res.status(404).json({ error: "Receipt not in folder" });
    }
    const body = z.object({ name: z.string().trim().min(1).optional(), price: z.union([z.string(), z.number()]).optional(), quantity: z.union([z.string(), z.number()]).optional(), category: z.string().nullable().optional(), notes: z.string().nullable().optional() }).parse(req.body);
    const itemPrice = body.price === undefined ? undefined : Number(body.price);
    if (itemPrice !== undefined && (!Number.isFinite(itemPrice) || itemPrice < 0)) {
      return res.status(400).json({ error: "Price must be a finite non-negative amount" });
    }
    const result = await splitFolderStorage.updateReceiptItemIfUnsettled(
      folder.id,
      receipt.id,
      req.params.itemId,
      {
        ...body,
        price: itemPrice === undefined ? undefined : money(itemPrice).toFixed(2),
        quantity: body.quantity === undefined ? undefined : String(body.quantity),
      },
    );
    if (result.status === "paidConflict") {
      return res.status(409).json({ error: "Mark this receipt's paid shares as unpaid before editing its items" });
    }
    if (result.status === "notFound") return res.status(404).json({ error: "Item not found" });
    res.json(result.item);
  });

  app.get("/api/split-folders/:id/subfolders", requireAuth, async (req: AuthenticatedRequest, res) => {
    const folder = await loadFolderForUser(req.params.id, req.user!.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    res.json(await splitFolderStorage.listSubfolders(folder.id));
  });
  app.post("/api/split-folders/:id/subfolders", requireAuth, async (req: AuthenticatedRequest, res) => {
    const folder = await loadFolderForUser(req.params.id, req.user!.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    if (!(await requireFolderPermission(folder, req.user!.id, "edit", res))) return;
    const body = z.object({ name: z.string().trim().min(1).optional(), monthlyKey: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional() }).parse(req.body);
    if (!body.name && !body.monthlyKey) return res.status(400).json({ error: "Name or monthlyKey is required" });
    const name = body.name || new Date(`${body.monthlyKey}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
    const existing = await splitFolderStorage.listSubfolders(folder.id);
    if (existing.some((s) => s.name.toLowerCase() === name.toLowerCase() || (!!body.monthlyKey && s.monthlyKey === body.monthlyKey))) return res.status(409).json({ error: "Subfolder already exists" });
    const subfolder = await splitFolderStorage.createSubfolder({ folderId: folder.id, name, monthlyKey: body.monthlyKey });
    await splitFolderStorage.createActivity({ folderId: folder.id, actorUserId: req.user!.id, eventType: "subfolder.created", metadata: { subfolderId: subfolder.id } });
    res.status(201).json(subfolder);
  });
  app.patch("/api/split-folders/:id/subfolders/:subfolderId", requireAuth, async (req: AuthenticatedRequest, res) => {
    const folder = await loadFolderForUser(req.params.id, req.user!.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    if (!(await requireFolderPermission(folder, req.user!.id, "edit", res))) return;
    const found = (await splitFolderStorage.listSubfolders(folder.id)).find((s) => s.id === req.params.subfolderId);
    if (!found) return res.status(404).json({ error: "Subfolder not found" });
    res.json(await splitFolderStorage.updateSubfolder(found.id, z.object({ name: z.string().trim().min(1).optional(), monthlyKey: z.string().nullable().optional() }).parse(req.body)));
  });
  app.delete("/api/split-folders/:id/subfolders/:subfolderId", requireAuth, async (req: AuthenticatedRequest, res) => {
    const folder = await loadFolderForUser(req.params.id, req.user!.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    if (!(await requireFolderPermission(folder, req.user!.id, "edit", res))) return;
    if (!(await splitFolderStorage.listSubfolders(folder.id)).some((s) => s.id === req.params.subfolderId)) return res.status(404).json({ error: "Subfolder not found" });
    await splitFolderStorage.deleteSubfolder(req.params.subfolderId); res.json({ ok: true });
  });
  app.patch("/api/split-folders/:id/receipts/:receiptId/metadata", requireAuth, async (req: AuthenticatedRequest, res) => {
    const folder = await loadFolderForUser(req.params.id, req.user!.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    if (!(await requireFolderPermission(folder, req.user!.id, "edit", res))) return;
    const receipt = await storage.getReceipt(req.params.receiptId);
    if (!receipt || receipt.splitFolderId !== folder.id) return res.status(404).json({ error: "Receipt not in folder" });
    const body = z.object({ subfolderId: z.string().nullable(), displayName: z.string().trim().min(1).nullable().optional() }).parse(req.body);
    if (body.subfolderId && !(await splitFolderStorage.listSubfolders(folder.id)).some((s) => s.id === body.subfolderId)) return res.status(400).json({ error: "Invalid subfolder" });
    await splitFolderStorage.setReceiptMetadata(folder.id, receipt.id, body.subfolderId, body.displayName);
    res.json({ ok: true });
  });

  // Hub-level one-off bills create a dedicated workspace rather than requiring
  // a pre-existing ongoing folder.
  app.get("/api/split-bills", requireAuth, async (req: AuthenticatedRequest, res) => {
    const folders = await splitFolderStorage.listFoldersForUser(req.user!.id);
    const bills = (await Promise.all(folders.filter((f) => f.workspaceType === "one_off").map((f) => splitFolderStorage.listBills(f.id)))).flat();
    res.json(bills);
  });
  app.post("/api/split-bills", requireAuth, async (req: AuthenticatedRequest, res) => {
    const body = z.object({
      title: z.string().trim().min(1),
      description: z.string().optional(),
      amount: z.union([z.string(), z.number()]),
      splitMode: z.enum(["equal", "custom", "items"]),
      participants: z.array(z.object({
        key: z.string().min(1),
        name: z.string().trim().min(1),
        email: z.string().email().optional(),
        shareAmount: z.union([z.string(), z.number()]).optional(),
        isCreator: z.boolean().optional(),
      })).min(1),
      items: z.array(z.object({
        key: z.string().min(1),
        label: z.string().trim().min(1),
        amount: z.union([z.string(), z.number()]),
        participantKeys: z.array(z.string()).min(1),
      })).optional(),
    }).parse(req.body);
    const amount = money(body.amount);
    if (amount <= 0) return res.status(400).json({ error: "Amount must be positive" });
    if (body.participants.filter((participant) => participant.isCreator).length !== 1) return res.status(400).json({ error: "Exactly one creator participant is required" });
    if (new Set(body.participants.map((p) => p.key)).size !== body.participants.length) return res.status(400).json({ error: "Participant keys must be unique" });

    const participantIndex = new Map(body.participants.map((participant, index) => [participant.key, index]));
    const billItems: Array<{ billId: string; itemKey: string; label: string; amount: string }> = [];
    const participantRows: Array<{ billId: string; memberId: string; itemId: string | null; shareAmount: string; status: string }> = [];

    if (body.splitMode === "items") {
      const items = body.items || [];
      if (!items.length) return res.status(400).json({ error: "Item-level bills need at least one item" });
      if (new Set(items.map((item) => item.key)).size !== items.length) return res.status(400).json({ error: "Bill item keys must be unique" });
      const itemTotal = items.reduce((sum, item) => sum + money(item.amount), 0);
      if (Math.abs(itemTotal - amount) > 0.01) {
        return res.status(400).json({ error: `Items add up to £${itemTotal.toFixed(2)}, but the bill is £${amount.toFixed(2)}` });
      }
      for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
        const item = items[itemIndex];
        if (money(item.amount) < 0) return res.status(400).json({ error: "Item amounts must be non-negative" });
        const indexes = item.participantKeys.map((key: string) => participantIndex.get(key));
        if (indexes.some((index: number | undefined) => index === undefined)) return res.status(400).json({ error: "Invalid participant assigned to a bill item" });
        billItems.push({ billId: "", itemKey: item.key, label: item.label, amount: money(item.amount).toFixed(2) });
        const shares = splitEvenly(money(item.amount), indexes.length);
        indexes.forEach((index: number | undefined, memberIndex: number) => {
          participantRows.push({
            billId: "",
            memberId: String(index),
            itemId: String(itemIndex),
            shareAmount: shares[memberIndex],
            status: "pending",
          });
        });
      }
    } else {
      const debtorParticipants = body.participants.filter((participant) => !participant.isCreator);
      const equalDebtorShares = body.splitMode === "equal"
        ? splitEvenly(amount, debtorParticipants.length)
        : [];
      let equalDebtorIndex = 0;
      const shares = body.splitMode === "equal"
        ? body.participants.map((participant) =>
            participant.isCreator ? "0.00" : equalDebtorShares[equalDebtorIndex++])
        : body.participants.map((participant) => money(participant.shareAmount).toFixed(2));
      const normalized = body.participants.map((participant, index) => ({
        ...participant,
        shareAmount: shares[index],
      }));
      const issue = validateAllocations(amount, normalized);
      if (issue || allocationSummary(amount, normalized).personal !== 0) {
        return res.status(400).json({ error: issue || "Bill shares must equal its amount" });
      }
      normalized.forEach((participant, index) => {
        participantRows.push({
          billId: "",
          memberId: String(index),
          itemId: null,
          shareAmount: participant.shareAmount,
          status: "pending",
        });
      });
    }

    const token = newToken();
    const bill = await splitFolderStorage.createOneOffWorkspace(
      { ownerId: req.user!.id, name: body.title, workspaceType: "one_off" },
      body.participants.map((p, index) => ({
        folderId: "", userId: p.isCreator ? req.user!.id : null, inviteEmail: p.email, displayName: p.isCreator ? (req.user!.name || req.user!.email || "You") : p.name,
        inviteToken: index === 0 ? token : newToken(), status: p.isCreator ? "active" : "invited", role: p.isCreator ? "owner" : "viewer",
      })),
      { folderId: "", createdBy: req.user!.id, title: body.title, description: body.description, amount: amount.toFixed(2), currency: "GBP", splitMode: body.splitMode, status: "unpaid" },
      billItems,
      participantRows,
    );
    const expanded = (await splitFolderStorage.listBills(bill.folderId)).find((row) => row.id === bill.id);
    res.status(201).json(expanded ?? bill);
  });
}
