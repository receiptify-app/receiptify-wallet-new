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
  type SplitFolder,
  type SplitFolderMember,
  type SplitAssignment,
  type InsertSplitFolder,
  type InsertSplitFolderMember,
  type InsertSplitAssignment,
  type Receipt,
  type ReceiptItem,
} from "@shared/schema";
import { and, desc, eq, ilike, inArray } from "drizzle-orm";

export interface ISplitFolderStorage {
  listFoldersForUser(userId: string): Promise<SplitFolder[]>;
  getFolder(folderId: string): Promise<SplitFolder | undefined>;
  createFolder(folder: InsertSplitFolder): Promise<SplitFolder>;

  listMembers(folderId: string): Promise<SplitFolderMember[]>;
  getMember(memberId: string): Promise<SplitFolderMember | undefined>;
  getMemberByToken(token: string): Promise<SplitFolderMember | undefined>;
  createMember(member: InsertSplitFolderMember): Promise<SplitFolderMember>;
  updateMember(id: string, updates: Partial<InsertSplitFolderMember> & { status?: string; joinedAt?: Date | null }): Promise<SplitFolderMember | undefined>;

  isUserActiveInFolder(folderId: string, userId: string): Promise<boolean>;

  listFolderReceipts(folderId: string): Promise<Receipt[]>;
  attachReceipt(receiptId: string, folderId: string): Promise<Receipt | undefined>;
  detachReceipt(receiptId: string, folderId: string): Promise<void>;
  getReceiptItemsForReceipts(receiptIds: string[]): Promise<ReceiptItem[]>;

  listAssignments(folderId: string): Promise<SplitAssignment[]>;
  replaceReceiptAssignments(folderId: string, receiptId: string, rows: InsertSplitAssignment[]): Promise<SplitAssignment[]>;
  clearReceiptAssignments(folderId: string, receiptId: string): Promise<void>;
  clearMemberAssignments(memberId: string): Promise<void>;
  markMemberSettled(folderId: string, memberId: string): Promise<void>;

  searchUsernames(query: string, excludeUserId: string, limit?: number): Promise<Array<Pick<typeof users.$inferSelect, "id" | "username" | "firstName" | "lastName" | "profileImageUrl">>>;
  findUserByUsername(username: string): Promise<typeof users.$inferSelect | undefined>;
  findUserByEmail(email: string): Promise<typeof users.$inferSelect | undefined>;
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

  async listAssignments(folderId: string): Promise<SplitAssignment[]> {
    return db.select().from(splitAssignments).where(eq(splitAssignments.folderId, folderId));
  }

  async replaceReceiptAssignments(folderId: string, receiptId: string, rows: InsertSplitAssignment[]): Promise<SplitAssignment[]> {
    await db
      .delete(splitAssignments)
      .where(
        and(eq(splitAssignments.folderId, folderId), eq(splitAssignments.receiptId, receiptId)),
      );
    if (rows.length) {
      await db.insert(splitAssignments).values(rows);
    }
    return db
      .select()
      .from(splitAssignments)
      .where(
        and(eq(splitAssignments.folderId, folderId), eq(splitAssignments.receiptId, receiptId)),
      );
  }

  async clearReceiptAssignments(folderId: string, receiptId: string): Promise<void> {
    await db
      .delete(splitAssignments)
      .where(
        and(eq(splitAssignments.folderId, folderId), eq(splitAssignments.receiptId, receiptId)),
      );
  }

  async clearMemberAssignments(memberId: string): Promise<void> {
    await db.delete(splitAssignments).where(eq(splitAssignments.memberId, memberId));
  }

  async markMemberSettled(folderId: string, memberId: string): Promise<void> {
    await db
      .update(splitAssignments)
      .set({ status: "paid" })
      .where(
        and(eq(splitAssignments.folderId, folderId), eq(splitAssignments.memberId, memberId)),
      );
  }

  async searchUsernames(query: string, excludeUserId: string, limit = 8) {
    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
      })
      .from(users)
      .where(ilike(users.username, `${query}%`))
      .limit(limit);
    return rows.filter((r) => r.id !== excludeUserId);
  }

  async findUserByUsername(username: string) {
    const [row] = await db.select().from(users).where(eq(users.username, username));
    return row;
  }

  async findUserByEmail(email: string) {
    const [row] = await db.select().from(users).where(eq(users.email, email));
    return row;
  }
}

export const splitFolderStorage: ISplitFolderStorage = new SplitFolderDbStorage();
