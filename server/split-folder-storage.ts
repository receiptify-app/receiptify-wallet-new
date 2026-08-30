// Storage layer for the split-folders feature. Keeps route handlers thin and
// confines every database access for split folders to this module.

import { db } from "./db";
import {
  splitFolders,
  splitFolderMembers,
  splitAssignments,
  receipts,
  receiptItems,
  users,
  splitManualExpenses, splitActivityEvents, splitBills, splitBillParticipants, splitBillItems, splitPaymentRequests, splitPaymentEvents, splitSubfolders, splitFolderReceiptMetadata,
  type SplitFolder,
  type SplitFolderMember,
  type SplitAssignment,
  type InsertSplitFolder,
  type InsertSplitFolderMember,
  type InsertSplitAssignment,
  type Receipt,
  type ReceiptItem,
  type SplitManualExpense, type SplitActivityEvent, type SplitBill, type SplitBillParticipant,
  type SplitPaymentRequest, type InsertSplitManualExpense, type InsertSplitActivityEvent,
  type InsertSplitBill, type InsertSplitBillParticipant, type InsertSplitPaymentRequest,
  type SplitSubfolder, type SplitFolderReceiptMetadata, type InsertSplitSubfolder,
  type SplitBillItem, type InsertSplitBillItem,
} from "@shared/schema";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";

function normShare(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "0";
  const n = typeof v === "number" ? v : parseFloat(v);
  if (!isFinite(n)) return "0";
  return n.toFixed(2);
}

function assignmentKey(memberId: string, itemId: string | null | undefined, shareAmount: string | number): string {
  return `${memberId}|${itemId ?? ""}|${normShare(shareAmount)}`;
}

export type ExistingAssignmentLike = {
  id: string;
  memberId: string;
  itemId: string | null;
  shareAmount: string;
  status?: string | null;
};

export type DesiredAssignmentLike = {
  memberId: string;
  itemId: string | null;
  shareAmount: string;
};

export function diffReceiptAssignments(
  existing: ExistingAssignmentLike[],
  desired: DesiredAssignmentLike[],
): { toDeleteIds: string[]; toInsertIndexes: number[]; paidConflictIds: string[] } {
  const existingByKey = new Map<string, ExistingAssignmentLike>();
  for (const e of existing) existingByKey.set(assignmentKey(e.memberId, e.itemId, e.shareAmount), e);

  const desiredKeys = new Set<string>();
  const toInsertIndexes: number[] = [];
  desired.forEach((d, i) => {
    const key = assignmentKey(d.memberId, d.itemId, d.shareAmount);
    desiredKeys.add(key);
    if (!existingByKey.has(key)) toInsertIndexes.push(i);
  });

  const toDeleteIds: string[] = [];
  const paidConflictIds: string[] = [];
  for (const [key, e] of Array.from(existingByKey.entries())) {
    if (!desiredKeys.has(key)) {
      toDeleteIds.push(e.id);
      if (e.status === "paid") paidConflictIds.push(e.id);
    }
  }
  return { toDeleteIds, toInsertIndexes, paidConflictIds };
}

export interface ISplitFolderStorage {
  listFoldersForUser(userId: string): Promise<SplitFolder[]>;
  getFolder(folderId: string): Promise<SplitFolder | undefined>;
  createFolder(folder: InsertSplitFolder): Promise<SplitFolder>;
  createOneOffWorkspace(folder: InsertSplitFolder, members: InsertSplitFolderMember[], bill: InsertSplitBill, items: InsertSplitBillItem[], participants: InsertSplitBillParticipant[]): Promise<SplitBill>;
  updateFolder(folderId: string, updates: Partial<InsertSplitFolder>): Promise<SplitFolder | undefined>;
  listSubfolders(folderId: string): Promise<SplitSubfolder[]>;
  createSubfolder(row: InsertSplitSubfolder): Promise<SplitSubfolder>;
  updateSubfolder(id: string, updates: Partial<InsertSplitSubfolder>): Promise<SplitSubfolder | undefined>;
  deleteSubfolder(id: string): Promise<void>;
  setReceiptMetadata(folderId: string, receiptId: string, subfolderId: string | null, displayName?: string | null): Promise<void>;
  listReceiptMetadata(folderId: string): Promise<SplitFolderReceiptMetadata[]>;

  listMembers(folderId: string): Promise<SplitFolderMember[]>;
  getMember(memberId: string): Promise<SplitFolderMember | undefined>;
  getMemberByToken(token: string): Promise<SplitFolderMember | undefined>;
  createMember(member: InsertSplitFolderMember): Promise<SplitFolderMember>;
  updateMember(id: string, updates: Partial<InsertSplitFolderMember> & { status?: string; joinedAt?: Date | null }): Promise<SplitFolderMember | undefined>;
  activateMemberIfInvited(id: string, userId: string, joinedAt: Date): Promise<{ member: SplitFolderMember; activated: boolean } | undefined>;

  isUserActiveInFolder(folderId: string, userId: string): Promise<boolean>;

  listFolderReceipts(folderId: string): Promise<Receipt[]>;
  attachReceipt(receiptId: string, folderId: string): Promise<Receipt | undefined>;
  detachReceipt(receiptId: string, folderId: string): Promise<void>;
  getReceiptItemsForReceipts(receiptIds: string[]): Promise<ReceiptItem[]>;
  listManualExpenses(folderId: string): Promise<SplitManualExpense[]>;
  createManualExpense(expense: InsertSplitManualExpense): Promise<SplitManualExpense>;
  updateManualExpense(id: string, updates: Partial<InsertSplitManualExpense>): Promise<SplitManualExpense | undefined>;
  deleteManualExpense(folderId: string, id: string): Promise<boolean>;
  listActivity(folderId: string): Promise<SplitActivityEvent[]>;
  createActivity(event: InsertSplitActivityEvent): Promise<SplitActivityEvent>;
  listBills(folderId: string): Promise<Array<SplitBill & { participants: SplitBillParticipant[]; items: SplitBillItem[] }>>;
  createBill(bill: InsertSplitBill, participants: InsertSplitBillParticipant[], items?: InsertSplitBillItem[]): Promise<SplitBill>;
  updateBillStatus(id: string, status: string): Promise<void>;
  updateBillParticipant(id: string, status: string, expectedStatus: string): Promise<SplitBillParticipant | undefined>;
  listPaymentRequests(folderId: string): Promise<SplitPaymentRequest[]>;
  createPaymentRequest(request: InsertSplitPaymentRequest): Promise<SplitPaymentRequest>;
  updatePaymentRequest(id: string, updates: Partial<InsertSplitPaymentRequest>): Promise<SplitPaymentRequest | undefined>;
  createPaymentEvent(event: { paymentRequestId: string; eventType: string; stripeEventId?: string | null; metadata?: unknown }): Promise<void>;

  listAssignments(folderId: string): Promise<SplitAssignment[]>;
  replaceReceiptAssignments(folderId: string, receiptId: string, rows: InsertSplitAssignment[]): Promise<SplitAssignment[]>;
  clearReceiptAssignments(folderId: string, receiptId: string): Promise<boolean>;
  clearMemberAssignments(memberId: string): Promise<void>;
  removeMemberFinancials(folderId: string, memberId: string): Promise<{ paidConflict: boolean }>;
  markMemberSettled(folderId: string, memberId: string): Promise<boolean>;
  markMemberUnsettled(folderId: string, memberId: string): Promise<number>;
  getSharedReceiptsForUser(userId: string): Promise<Array<Receipt & { isShared: true }>>;

  findUserByEmail(email: string): Promise<typeof users.$inferSelect | undefined>;

  deleteFolder(folderId: string): Promise<void>;
  deleteFolderIfUnsettled(folderId: string): Promise<boolean>;
}

class SplitFolderDbStorage implements ISplitFolderStorage {
  async listFoldersForUser(userId: string): Promise<SplitFolder[]> {
    const owned = await db.select().from(splitFolders).where(eq(splitFolders.ownerId, userId));
    const memberships = await db
      .select({ folderId: splitFolderMembers.folderId })
      .from(splitFolderMembers)
      .where(and(eq(splitFolderMembers.userId, userId), eq(splitFolderMembers.status, "active")));
    const memberFolderIds = memberships.map((m) => m.folderId);
    const memberFolders = memberFolderIds.length
      ? await db.select().from(splitFolders).where(inArray(splitFolders.id, memberFolderIds))
      : [];
    const map = new Map<string, SplitFolder>();
    [...owned, ...memberFolders].forEach((f) => map.set(f.id, f));
    return Array.from(map.values()).sort(
      (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
    );
  }

  async getFolder(folderId: string): Promise<SplitFolder | undefined> {
    const [folder] = await db.select().from(splitFolders).where(eq(splitFolders.id, folderId));
    return folder;
  }

  async createFolder(folder: InsertSplitFolder): Promise<SplitFolder> {
    const [row] = await db.insert(splitFolders).values(folder).returning();
    return row;
  }
  async createOneOffWorkspace(folder: InsertSplitFolder, members: InsertSplitFolderMember[], bill: InsertSplitBill, items: InsertSplitBillItem[], participants: InsertSplitBillParticipant[]) {
    return db.transaction(async (tx) => {
      const [workspace] = await tx.insert(splitFolders).values(folder).returning();
      const createdMembers = await tx.insert(splitFolderMembers).values(members.map((member) => ({ ...member, folderId: workspace.id }))).returning();
      const ids = new Map(createdMembers.map((member, index) => [String(index), member.id]));
      const [createdBill] = await tx.insert(splitBills).values({ ...bill, folderId: workspace.id }).returning();
      const createdItems = items.length ? await tx.insert(splitBillItems).values(items.map((item) => ({ ...item, billId: createdBill.id }))).returning() : [];
      const itemIds = new Map(createdItems.map((item, index) => [String(index), item.id]));
      await tx.insert(splitBillParticipants).values(participants.map((p) => ({ ...p, billId: createdBill.id, memberId: ids.get(p.memberId) || p.memberId, itemId: p.itemId ? (itemIds.get(p.itemId) || p.itemId) : null })));
      return createdBill;
    });
  }
  async updateFolder(folderId: string, updates: Partial<InsertSplitFolder>) {
    const [row] = await db.update(splitFolders).set({ ...updates, updatedAt: new Date() }).where(eq(splitFolders.id, folderId)).returning();
    return row;
  }
  async listSubfolders(folderId: string) { return db.select().from(splitSubfolders).where(eq(splitSubfolders.folderId, folderId)); }
  async createSubfolder(row: InsertSplitSubfolder) { const [result] = await db.insert(splitSubfolders).values(row).returning(); return result; }
  async updateSubfolder(id: string, updates: Partial<InsertSplitSubfolder>) { const [result] = await db.update(splitSubfolders).set(updates).where(eq(splitSubfolders.id, id)).returning(); return result; }
  async deleteSubfolder(id: string) {
    await db.transaction(async (tx) => {
      await tx.update(splitFolderReceiptMetadata).set({ subfolderId: null }).where(eq(splitFolderReceiptMetadata.subfolderId, id));
      await tx.update(splitManualExpenses).set({ subfolderId: null }).where(eq(splitManualExpenses.subfolderId, id));
      await tx.update(splitBills).set({ subfolderId: null }).where(eq(splitBills.subfolderId, id));
      await tx.delete(splitSubfolders).where(eq(splitSubfolders.id, id));
    });
  }
  async setReceiptMetadata(folderId: string, receiptId: string, subfolderId: string | null, displayName?: string | null) {
    const existing = await db.select().from(splitFolderReceiptMetadata).where(and(eq(splitFolderReceiptMetadata.folderId, folderId), eq(splitFolderReceiptMetadata.receiptId, receiptId)));
    if (existing[0]) await db.update(splitFolderReceiptMetadata).set({ subfolderId, displayName: displayName === undefined ? existing[0].displayName : displayName, updatedAt: new Date() }).where(eq(splitFolderReceiptMetadata.id, existing[0].id));
    else await db.insert(splitFolderReceiptMetadata).values({ folderId, receiptId, subfolderId, displayName: displayName ?? null });
  }
  async listReceiptMetadata(folderId: string) { return db.select().from(splitFolderReceiptMetadata).where(eq(splitFolderReceiptMetadata.folderId, folderId)); }

  async listMembers(folderId: string): Promise<SplitFolderMember[]> {
    return db.select().from(splitFolderMembers).where(eq(splitFolderMembers.folderId, folderId));
  }

  async getMember(memberId: string): Promise<SplitFolderMember | undefined> {
    const [row] = await db.select().from(splitFolderMembers).where(eq(splitFolderMembers.id, memberId));
    return row;
  }

  async getMemberByToken(token: string): Promise<SplitFolderMember | undefined> {
    const [row] = await db.select().from(splitFolderMembers).where(eq(splitFolderMembers.inviteToken, token));
    return row;
  }

  async createMember(member: InsertSplitFolderMember): Promise<SplitFolderMember> {
    const [row] = await db.insert(splitFolderMembers).values(member).returning();
    return row;
  }

  async updateMember(id: string, updates: Partial<InsertSplitFolderMember> & { status?: string; joinedAt?: Date | null }) {
    const [row] = await db
      .update(splitFolderMembers)
      .set(updates as any)
      .where(eq(splitFolderMembers.id, id))
      .returning();
    return row;
  }

  async activateMemberIfInvited(id: string, userId: string, joinedAt: Date) {
    const [activated] = await db
      .update(splitFolderMembers)
      .set({ userId, status: "active", joinedAt })
      .where(and(eq(splitFolderMembers.id, id), eq(splitFolderMembers.status, "invited")))
      .returning();
    if (activated) return { member: activated, activated: true };
    const current = await this.getMember(id);
    return current ? { member: current, activated: false } : undefined;
  }

  async isUserActiveInFolder(folderId: string, userId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: splitFolderMembers.id })
      .from(splitFolderMembers)
      .where(
        and(
          eq(splitFolderMembers.folderId, folderId),
          eq(splitFolderMembers.userId, userId),
          eq(splitFolderMembers.status, "active"),
        ),
      );
    return !!row;
  }

  async listFolderReceipts(folderId: string): Promise<Receipt[]> {
    return db
      .select()
      .from(receipts)
      .where(eq(receipts.splitFolderId, folderId))
      .orderBy(desc(receipts.date));
  }

  async attachReceipt(receiptId: string, folderId: string): Promise<Receipt | undefined> {
    const [row] = await db
      .update(receipts)
      .set({ splitFolderId: folderId })
      .where(eq(receipts.id, receiptId))
      .returning();
    return row;
  }

  async detachReceipt(receiptId: string, folderId: string): Promise<void> {
    await db
      .update(receipts)
      .set({ splitFolderId: null })
      .where(and(eq(receipts.id, receiptId), eq(receipts.splitFolderId, folderId)));
  }

  async getReceiptItemsForReceipts(receiptIds: string[]): Promise<ReceiptItem[]> {
    if (!receiptIds.length) return [];
    return db.select().from(receiptItems).where(inArray(receiptItems.receiptId, receiptIds));
  }
  async listManualExpenses(folderId: string) {
    return db.select().from(splitManualExpenses).where(eq(splitManualExpenses.folderId, folderId)).orderBy(desc(splitManualExpenses.expenseDate));
  }
  async createManualExpense(expense: InsertSplitManualExpense) {
    const [row] = await db.insert(splitManualExpenses).values(expense).returning(); return row;
  }
  async updateManualExpense(id: string, updates: Partial<InsertSplitManualExpense>) {
    const [row] = await db.update(splitManualExpenses).set({ ...updates, updatedAt: new Date() }).where(eq(splitManualExpenses.id, id)).returning(); return row;
  }
  async deleteManualExpense(folderId: string, id: string) {
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select id from split_assignments
            where folder_id = ${folderId} and source_type = 'expense' and source_id = ${id}
            for update`,
      );
      const paid = await tx
        .select({ id: splitAssignments.id })
        .from(splitAssignments)
        .where(
          and(
            eq(splitAssignments.folderId, folderId),
            eq(splitAssignments.sourceType, "expense"),
            eq(splitAssignments.sourceId, id),
            eq(splitAssignments.status, "paid"),
          ),
        );
      if (paid.length) return false;
      await tx
        .delete(splitAssignments)
        .where(
          and(
            eq(splitAssignments.folderId, folderId),
            eq(splitAssignments.sourceType, "expense"),
            eq(splitAssignments.sourceId, id),
          ),
        );
      await tx
        .delete(splitManualExpenses)
        .where(and(eq(splitManualExpenses.folderId, folderId), eq(splitManualExpenses.id, id)));
      return true;
    });
  }
  async listActivity(folderId: string) {
    return db.select().from(splitActivityEvents).where(eq(splitActivityEvents.folderId, folderId)).orderBy(desc(splitActivityEvents.createdAt));
  }
  async createActivity(event: InsertSplitActivityEvent) {
    const [row] = await db.insert(splitActivityEvents).values(event).returning(); return row;
  }
  async listBills(folderId: string) {
    const bills = await db.select().from(splitBills).where(eq(splitBills.folderId, folderId));
    if (!bills.length) return [];
    const [participants, items] = await Promise.all([
      db.select().from(splitBillParticipants).where(inArray(splitBillParticipants.billId, bills.map((b) => b.id))),
      db.select().from(splitBillItems).where(inArray(splitBillItems.billId, bills.map((b) => b.id))),
    ]);
    return bills.map((bill) => ({ ...bill, participants: participants.filter((p) => p.billId === bill.id), items: items.filter((item) => item.billId === bill.id) }));
  }
  async createBill(bill: InsertSplitBill, participants: InsertSplitBillParticipant[], items: InsertSplitBillItem[] = []) {
    return db.transaction(async (tx) => {
      const [created] = await tx.insert(splitBills).values(bill).returning();
      const createdItems = items.length
        ? await tx.insert(splitBillItems).values(items.map((item) => ({ ...item, billId: created.id }))).returning()
        : [];
      const itemIds = new Map(createdItems.map((item, index) => [String(index), item.id]));
      if (participants.length) {
        await tx.insert(splitBillParticipants).values(participants.map((participant) => ({
          ...participant,
          billId: created.id,
          itemId:
            participant.itemId !== null && participant.itemId !== undefined
              ? itemIds.get(participant.itemId) || participant.itemId
              : null,
        })));
      }
      return created;
    });
  }
  async updateBillParticipant(id: string, status: string, expectedStatus: string) {
    return db.transaction(async (tx) => {
      const [participant] = await tx
        .select()
        .from(splitBillParticipants)
        .where(eq(splitBillParticipants.id, id));
      if (!participant) return undefined;
      await tx.execute(
        sql`select id from split_folder_members where id = ${participant.memberId} for update`,
      );
      const [member] = await tx
        .select()
        .from(splitFolderMembers)
        .where(eq(splitFolderMembers.id, participant.memberId));
      if (!member || member.status === "removed") return undefined;
      const [current] = await tx
        .select()
        .from(splitBillParticipants)
        .where(eq(splitBillParticipants.id, id));
      if (!current || current.status !== expectedStatus) return undefined;
      const [row] = await tx
        .update(splitBillParticipants)
        .set({ status, paidAt: status === "paid" ? new Date() : null })
        .where(
          and(
            eq(splitBillParticipants.id, id),
            eq(splitBillParticipants.status, expectedStatus),
          ),
        )
        .returning();
      return row;
    });
  }
  async updateBillStatus(id: string, status: string) {
    await db.update(splitBills).set({ status, updatedAt: new Date() }).where(eq(splitBills.id, id));
  }
  async listPaymentRequests(folderId: string) { return db.select().from(splitPaymentRequests).where(eq(splitPaymentRequests.folderId, folderId)); }
  async createPaymentRequest(request: InsertSplitPaymentRequest) { const [row] = await db.insert(splitPaymentRequests).values(request).returning(); return row; }
  async updatePaymentRequest(id: string, updates: Partial<InsertSplitPaymentRequest>) {
    const [row] = await db.update(splitPaymentRequests).set({ ...updates, updatedAt: new Date() }).where(eq(splitPaymentRequests.id, id)).returning(); return row;
  }
  async createPaymentEvent(event: { paymentRequestId: string; eventType: string; stripeEventId?: string | null; metadata?: unknown }) {
    await db.insert(splitPaymentEvents).values({ ...event, metadata: event.metadata as any });
  }

  async listAssignments(folderId: string): Promise<SplitAssignment[]> {
    return db.select().from(splitAssignments).where(eq(splitAssignments.folderId, folderId));
  }

  async replaceReceiptAssignments(folderId: string, receiptId: string, rows: InsertSplitAssignment[]): Promise<SplitAssignment[]> {
    // Preserve existing rows whose (memberId, itemId, shareAmount) is unchanged
    // so already-"paid" assignments don't get reset to "pending" when the owner
    // edits the split (e.g. adds another friend).
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select id from split_assignments
            where folder_id = ${folderId} and receipt_id = ${receiptId}
            for update`,
      );
      const existing = await tx.select().from(splitAssignments).where(and(eq(splitAssignments.folderId, folderId), eq(splitAssignments.receiptId, receiptId)));
      const { toDeleteIds, toInsertIndexes, paidConflictIds } = diffReceiptAssignments(existing, rows.map((r) => ({ memberId: r.memberId, itemId: r.itemId ?? null, shareAmount: String(r.shareAmount) })));
      if (paidConflictIds.length) {
        throw new Error("Paid assignments must be marked unpaid before changing or removing them");
      }
      if (toDeleteIds.length) await tx.delete(splitAssignments).where(inArray(splitAssignments.id, toDeleteIds));
      if (toInsertIndexes.length) await tx.insert(splitAssignments).values(toInsertIndexes.map((i) => rows[i]));
      return tx.select().from(splitAssignments).where(and(eq(splitAssignments.folderId, folderId), eq(splitAssignments.receiptId, receiptId)));
    });
  }

  async clearReceiptAssignments(folderId: string, receiptId: string): Promise<boolean> {
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select id from split_assignments
            where folder_id = ${folderId} and receipt_id = ${receiptId}
            for update`,
      );
      const paid = await tx
        .select({ id: splitAssignments.id })
        .from(splitAssignments)
        .where(
          and(
            eq(splitAssignments.folderId, folderId),
            eq(splitAssignments.receiptId, receiptId),
            eq(splitAssignments.status, "paid"),
          ),
        );
      if (paid.length) return false;
      await tx
        .delete(splitAssignments)
        .where(
          and(eq(splitAssignments.folderId, folderId), eq(splitAssignments.receiptId, receiptId)),
        );
      return true;
    });
  }

  async clearMemberAssignments(memberId: string): Promise<void> {
    await db.delete(splitAssignments).where(eq(splitAssignments.memberId, memberId));
  }

  async removeMemberFinancials(
    folderId: string,
    memberId: string,
  ): Promise<{ paidConflict: boolean }> {
    return db.transaction(async (tx) => {
      // Serialize removal with other member-state transitions.
      await tx.execute(
        sql`select id from split_folder_members where id = ${memberId} for update`,
      );
      const [member] = await tx
        .select()
        .from(splitFolderMembers)
        .where(and(eq(splitFolderMembers.id, memberId), eq(splitFolderMembers.folderId, folderId)));
      if (!member) return { paidConflict: false };

      const bills = await tx
        .select({ id: splitBills.id })
        .from(splitBills)
        .where(eq(splitBills.folderId, folderId));
      const billIds = bills.map((bill) => bill.id);
      const [paidAssignments, paidBillParticipants] = await Promise.all([
        tx
          .select({ id: splitAssignments.id })
          .from(splitAssignments)
          .where(
            and(
              eq(splitAssignments.folderId, folderId),
              eq(splitAssignments.memberId, memberId),
              eq(splitAssignments.status, "paid"),
            ),
          ),
        billIds.length
          ? tx
              .select({ id: splitBillParticipants.id })
              .from(splitBillParticipants)
              .where(
                and(
                  inArray(splitBillParticipants.billId, billIds),
                  eq(splitBillParticipants.memberId, memberId),
                  eq(splitBillParticipants.status, "paid"),
                ),
              )
          : Promise.resolve([]),
      ]);
      if (paidAssignments.length || paidBillParticipants.length) {
        return { paidConflict: true };
      }

      await tx
        .delete(splitAssignments)
        .where(
          and(
            eq(splitAssignments.folderId, folderId),
            eq(splitAssignments.memberId, memberId),
          ),
        );
      if (billIds.length) {
        await tx
          .update(splitBillParticipants)
          .set({ status: "declined", paidAt: null })
          .where(
            and(
              inArray(splitBillParticipants.billId, billIds),
              eq(splitBillParticipants.memberId, memberId),
            ),
          );

        for (const billId of billIds) {
          const participants = await tx
            .select({ status: splitBillParticipants.status })
            .from(splitBillParticipants)
            .where(eq(splitBillParticipants.billId, billId));
          const status =
            participants.length > 0 && participants.every((participant) => participant.status === "paid")
              ? "settled"
              : participants.some((participant) => participant.status === "paid")
                ? "partially_paid"
                : "unpaid";
          await tx
            .update(splitBills)
            .set({ status, updatedAt: new Date() })
            .where(eq(splitBills.id, billId));
        }
      }
      await tx
        .update(splitFolderMembers)
        .set({ status: "removed" })
        .where(eq(splitFolderMembers.id, memberId));
      return { paidConflict: false };
    });
  }

  async markMemberSettled(folderId: string, memberId: string): Promise<boolean> {
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select id from split_folder_members where id = ${memberId} for update`,
      );
      const [member] = await tx
        .select()
        .from(splitFolderMembers)
        .where(and(eq(splitFolderMembers.id, memberId), eq(splitFolderMembers.folderId, folderId)));
      if (!member || member.status === "removed") return false;
      await tx
        .update(splitAssignments)
        .set({ status: "paid" })
        .where(
          and(
            eq(splitAssignments.folderId, folderId),
            eq(splitAssignments.memberId, memberId),
            eq(splitAssignments.status, "pending"),
          ),
        );
      const bills = await tx.select({ id: splitBills.id }).from(splitBills).where(eq(splitBills.folderId, folderId));
      if (bills.length) {
        const billIds = bills.map((bill) => bill.id);
        await tx
          .update(splitBillParticipants)
          .set({ status: "paid", paidAt: new Date() })
          .where(
            and(
              inArray(splitBillParticipants.billId, billIds),
              eq(splitBillParticipants.memberId, memberId),
              eq(splitBillParticipants.status, "pending"),
            ),
          );
        for (const billId of billIds) {
          const participants = await tx
            .select({ status: splitBillParticipants.status })
            .from(splitBillParticipants)
            .where(eq(splitBillParticipants.billId, billId));
          const status =
            participants.length > 0 && participants.every((participant) => participant.status === "paid")
              ? "settled"
              : participants.some((participant) => participant.status === "paid")
                ? "partially_paid"
                : "unpaid";
          await tx
            .update(splitBills)
            .set({ status, updatedAt: new Date() })
            .where(eq(splitBills.id, billId));
        }
      }
      return true;
    });
  }

  async markMemberUnsettled(folderId: string, memberId: string): Promise<number> {
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select id from split_folder_members where id = ${memberId} for update`,
      );
      const [member] = await tx
        .select()
        .from(splitFolderMembers)
        .where(and(eq(splitFolderMembers.id, memberId), eq(splitFolderMembers.folderId, folderId)));
      if (!member || member.status === "removed") return 0;
      const rows = await tx
        .update(splitAssignments)
        .set({ status: "pending" })
        .where(
          and(
            eq(splitAssignments.folderId, folderId),
            eq(splitAssignments.memberId, memberId),
            eq(splitAssignments.status, "paid"),
          ),
        )
        .returning({ id: splitAssignments.id });
      const bills = await tx.select({ id: splitBills.id }).from(splitBills).where(eq(splitBills.folderId, folderId));
      const billIds = bills.map((bill) => bill.id);
      const billRows = billIds.length
        ? await tx
            .update(splitBillParticipants)
            .set({ status: "pending", paidAt: null })
            .where(and(inArray(splitBillParticipants.billId, billIds), eq(splitBillParticipants.memberId, memberId), eq(splitBillParticipants.status, "paid")))
            .returning({ id: splitBillParticipants.id })
        : [];
      for (const billId of billIds) {
        const participants = await tx
          .select({ status: splitBillParticipants.status })
          .from(splitBillParticipants)
          .where(eq(splitBillParticipants.billId, billId));
        const status =
          participants.length > 0 && participants.every((participant) => participant.status === "paid")
            ? "settled"
            : participants.some((participant) => participant.status === "paid")
              ? "partially_paid"
              : "unpaid";
        await tx
          .update(splitBills)
          .set({ status, updatedAt: new Date() })
          .where(eq(splitBills.id, billId));
      }
      return rows.length + billRows.length;
    });
  }

  // Receipts shared with a user via split folders they're an active member of.
  // Each receipt is returned with the member's own assigned share overriding
  // the personal-share fields, so client totals count only their portion.
  async getSharedReceiptsForUser(
    userId: string,
  ): Promise<Array<Receipt & { isShared: true }>> {
    const memberships = await db
      .select()
      .from(splitFolderMembers)
      .where(and(eq(splitFolderMembers.userId, userId), eq(splitFolderMembers.status, "active")));
    if (memberships.length === 0) return [];
    const folderIds = memberships.map((m) => m.folderId);
    const memberIds = memberships.map((m) => m.id);

    const [rows, assigns] = await Promise.all([
      db
        .select()
        .from(receipts)
        .where(and(inArray(receipts.splitFolderId, folderIds), ne(receipts.userId, userId)))
        .orderBy(desc(receipts.date)),
      db.select().from(splitAssignments).where(inArray(splitAssignments.memberId, memberIds)),
    ]);

    const shareByReceipt = new Map<string, number>();
    for (const a of assigns) {
      const amt = parseFloat(a.shareAmount);
      if (Number.isFinite(amt)) {
        shareByReceipt.set(a.receiptId, (shareByReceipt.get(a.receiptId) ?? 0) + amt);
      }
    }

    return rows.map((r) => ({
      ...r,
      isShared: true as const,
      myShareType: "amount",
      myShareValue: (shareByReceipt.get(r.id) ?? 0).toFixed(2),
    }));
  }

  async findUserByEmail(email: string) {
    const [row] = await db.select().from(users).where(eq(users.email, email));
    return row;
  }

  async deleteFolder(folderId: string): Promise<void> {
    // All-or-nothing: a mid-sequence failure must not leave the folder half-deleted.
    await db.transaction(async (tx) => {
      // Receipts stay in their owners' wallets — just detach them from the folder.
      await tx
        .update(receipts)
        .set({ splitFolderId: null })
        .where(eq(receipts.splitFolderId, folderId));
      await tx.delete(splitAssignments).where(eq(splitAssignments.folderId, folderId));
      await tx.delete(splitFolderReceiptMetadata).where(eq(splitFolderReceiptMetadata.folderId, folderId));
      await tx.delete(splitSubfolders).where(eq(splitSubfolders.folderId, folderId));
      await tx.delete(splitManualExpenses).where(eq(splitManualExpenses.folderId, folderId));
      await tx.delete(splitActivityEvents).where(eq(splitActivityEvents.folderId, folderId));
      const bills = await tx.select({ id: splitBills.id }).from(splitBills).where(eq(splitBills.folderId, folderId));
      if (bills.length) await tx.delete(splitBillParticipants).where(inArray(splitBillParticipants.billId, bills.map((b) => b.id)));
      await tx.delete(splitBills).where(eq(splitBills.folderId, folderId));
      await tx.delete(splitPaymentRequests).where(eq(splitPaymentRequests.folderId, folderId));
      await tx.delete(splitFolderMembers).where(eq(splitFolderMembers.folderId, folderId));
      await tx.delete(splitFolders).where(eq(splitFolders.id, folderId));
    });
  }

  async deleteFolderIfUnsettled(folderId: string): Promise<boolean> {
    return db.transaction(async (tx) => {
      // Settlement/status transitions lock these same rows first.
      await tx.execute(
        sql`select id from split_folder_members
            where folder_id = ${folderId}
            order by id
            for update`,
      );
      const paidAssignments = await tx
        .select({ id: splitAssignments.id })
        .from(splitAssignments)
        .where(and(eq(splitAssignments.folderId, folderId), eq(splitAssignments.status, "paid")));
      const bills = await tx
        .select({ id: splitBills.id })
        .from(splitBills)
        .where(eq(splitBills.folderId, folderId));
      const paidParticipants = bills.length
        ? await tx
            .select({ id: splitBillParticipants.id })
            .from(splitBillParticipants)
            .where(
              and(
                inArray(splitBillParticipants.billId, bills.map((bill) => bill.id)),
                eq(splitBillParticipants.status, "paid"),
              ),
            )
        : [];
      if (paidAssignments.length || paidParticipants.length) return false;

      await tx
        .update(receipts)
        .set({ splitFolderId: null })
        .where(eq(receipts.splitFolderId, folderId));
      await tx.delete(splitAssignments).where(eq(splitAssignments.folderId, folderId));
      await tx.delete(splitFolderReceiptMetadata).where(eq(splitFolderReceiptMetadata.folderId, folderId));
      await tx.delete(splitSubfolders).where(eq(splitSubfolders.folderId, folderId));
      await tx.delete(splitManualExpenses).where(eq(splitManualExpenses.folderId, folderId));
      await tx.delete(splitActivityEvents).where(eq(splitActivityEvents.folderId, folderId));
      if (bills.length) {
        await tx
          .delete(splitBillParticipants)
          .where(inArray(splitBillParticipants.billId, bills.map((bill) => bill.id)));
      }
      await tx.delete(splitBills).where(eq(splitBills.folderId, folderId));
      await tx.delete(splitPaymentRequests).where(eq(splitPaymentRequests.folderId, folderId));
      await tx.delete(splitFolderMembers).where(eq(splitFolderMembers.folderId, folderId));
      await tx.delete(splitFolders).where(eq(splitFolders.id, folderId));
      return true;
    });
  }
}

export const splitFolderStorage: ISplitFolderStorage = new SplitFolderDbStorage();
