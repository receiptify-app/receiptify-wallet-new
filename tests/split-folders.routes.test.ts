import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { type Server } from "node:http";
import express from "express";
import { inArray } from "drizzle-orm";
import { db, pool } from "../server/db";
import { storage } from "../server/storage";
import { splitFolderStorage } from "../server/split-folder-storage";
import { registerSplitFolderRoutes } from "../server/split-folders";
import {
  receiptItems,
  receipts,
  splitActivityEvents,
  splitAssignments,
  splitBillItems,
  splitBillParticipants,
  splitBills,
  splitFolderMembers,
  splitFolderReceiptMetadata,
  splitFolders,
  splitManualExpenses,
  splitPaymentRequests,
  splitSubfolders,
} from "../shared/schema";

type ApiResult = {
  status: number;
  data: any;
};

const runId = randomUUID();
const users = {
  owner: `split-route-owner-${runId}`,
  viewer: `split-route-viewer-${runId}`,
  contributor: `split-route-contributor-${runId}`,
  editor: `split-route-editor-${runId}`,
  outsider: `split-route-outsider-${runId}`,
};

const folderIds: string[] = [];
const receiptIds: string[] = [];
const itemIds: string[] = [];
const billIds: string[] = [];
const deliveredEmails: Array<{ to: string; subject: string; text?: string; html?: string }> = [];
let failNextEmail = false;
let throwNextEmail = false;

let server: Server | undefined;
let baseUrl = "";

function assertStatus(result: ApiResult, expected: number, label: string) {
  assert.equal(
    result.status,
    expected,
    `${label}: expected HTTP ${expected}, received ${result.status}: ${JSON.stringify(result.data)}`,
  );
}

async function api(
  userId: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiResult> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "x-split-test-user": userId,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return {
    status: response.status,
    data: text ? JSON.parse(text) : null,
  };
}

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`FAIL - ${name}`);
    throw error;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const userId = req.header("x-split-test-user");
    if (userId) {
      req.user = {
        id: userId,
        email: `${userId}@example.invalid`,
        name: userId,
      };
    }
    next();
  });
  registerSplitFolderRoutes(app, {
    sendEmail: async (message) => {
      deliveredEmails.push(message);
      if (throwNextEmail) {
        throwNextEmail = false;
        throw new Error("Intentional route-test sender exception");
      }
      if (failNextEmail) {
        failNextEmail = false;
        return { sent: false, reason: "Intentional route-test delivery failure" };
      }
      return { sent: true };
    },
  });
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind a TCP port");
  baseUrl = `http://127.0.0.1:${address.port}`;
}

async function cleanup() {
  // Deliberately bypass HTTP deletion so this suite can never send member emails.
  for (const folderId of [...folderIds].reverse()) {
    try {
      await splitFolderStorage.deleteFolder(folderId);
    } catch (error) {
      console.warn(`cleanup warning: could not delete split folder ${folderId}`, error);
    }
  }
  for (const itemId of [...itemIds].reverse()) {
    try {
      await storage.deleteReceiptItem(itemId);
    } catch (error) {
      console.warn(`cleanup warning: could not delete receipt item ${itemId}`, error);
    }
  }
  for (const receiptId of [...receiptIds].reverse()) {
    try {
      await storage.deleteReceipt(receiptId);
    } catch (error) {
      console.warn(`cleanup warning: could not delete receipt ${receiptId}`, error);
    }
  }
  if (folderIds.length) {
    const folderRows = await Promise.all([
      db.select({ id: splitFolders.id }).from(splitFolders).where(inArray(splitFolders.id, folderIds)),
      db.select({ id: splitFolderMembers.id }).from(splitFolderMembers).where(inArray(splitFolderMembers.folderId, folderIds)),
      db.select({ id: splitAssignments.id }).from(splitAssignments).where(inArray(splitAssignments.folderId, folderIds)),
      db.select({ id: splitManualExpenses.id }).from(splitManualExpenses).where(inArray(splitManualExpenses.folderId, folderIds)),
      db.select({ id: splitActivityEvents.id }).from(splitActivityEvents).where(inArray(splitActivityEvents.folderId, folderIds)),
      db.select({ id: splitBills.id }).from(splitBills).where(inArray(splitBills.folderId, folderIds)),
      db.select({ id: splitPaymentRequests.id }).from(splitPaymentRequests).where(inArray(splitPaymentRequests.folderId, folderIds)),
      db.select({ id: splitSubfolders.id }).from(splitSubfolders).where(inArray(splitSubfolders.folderId, folderIds)),
      db.select({ id: splitFolderReceiptMetadata.id }).from(splitFolderReceiptMetadata).where(inArray(splitFolderReceiptMetadata.folderId, folderIds)),
    ]);
    assert.equal(folderRows.flat().length, 0, "cleanup left disposable Split workspace rows behind");
  }
  if (billIds.length) {
    const [remainingParticipants, remainingBillItems] = await Promise.all([
      db.select({ id: splitBillParticipants.id }).from(splitBillParticipants).where(inArray(splitBillParticipants.billId, billIds)),
      db.select({ id: splitBillItems.id }).from(splitBillItems).where(inArray(splitBillItems.billId, billIds)),
    ]);
    assert.deepEqual(remainingParticipants, [], "cleanup left disposable bill participants behind");
    assert.deepEqual(remainingBillItems, [], "cleanup left disposable bill items behind");
  }
  if (receiptIds.length) {
    const remainingReceipts = await db.select({ id: receipts.id }).from(receipts).where(inArray(receipts.id, receiptIds));
    assert.deepEqual(remainingReceipts, [], "cleanup left disposable receipts behind");
  }
  if (itemIds.length) {
    const remainingItems = await db.select({ id: receiptItems.id }).from(receiptItems).where(inArray(receiptItems.id, itemIds));
    assert.deepEqual(remainingItems, [], "cleanup left disposable receipt items behind");
  }
  if (server) {
    await new Promise<void>((resolve, reject) =>
      server!.close((error) => (error ? reject(error) : resolve())),
    );
  }
  await pool.end();
}

async function main() {
  await startServer();

  const folderA = await splitFolderStorage.createFolder({
    ownerId: users.owner,
    name: `Split route permissions ${runId}`,
    description: "Disposable route-level authorization fixture",
    ownerContactEmail: `split-route-owner-${runId}@example.invalid`,
    workspaceType: "ongoing",
  });
  folderIds.push(folderA.id);

  const folderB = await splitFolderStorage.createFolder({
    ownerId: users.owner,
    name: `Split route foreign sources ${runId}`,
    description: "Disposable cross-folder fixture",
    workspaceType: "ongoing",
  });
  folderIds.push(folderB.id);

  const ownerMember = await splitFolderStorage.createMember({
    folderId: folderA.id,
    userId: users.owner,
    displayName: "Owner",
    inviteToken: `split-route-owner-${runId}`,
    status: "active",
    role: "owner",
  });
  const viewerMember = await splitFolderStorage.createMember({
    folderId: folderA.id,
    userId: users.viewer,
    displayName: "Viewer",
    inviteToken: `split-route-viewer-${runId}`,
    status: "active",
    role: "viewer",
  });
  await splitFolderStorage.createMember({
    folderId: folderA.id,
    userId: users.contributor,
    displayName: "Contributor",
    inviteToken: `split-route-contributor-${runId}`,
    status: "active",
    role: "contributor",
  });
  await splitFolderStorage.createMember({
    folderId: folderA.id,
    userId: users.editor,
    displayName: "Editor",
    inviteToken: `split-route-editor-${runId}`,
    status: "active",
    role: "editor",
  });
  await splitFolderStorage.createMember({
    folderId: folderB.id,
    userId: users.owner,
    displayName: "Owner",
    inviteToken: `split-route-foreign-owner-${runId}`,
    status: "active",
    role: "owner",
  });

  const receiptA = await storage.createReceipt({
    userId: users.owner,
    merchantName: `Split route receipt ${runId}`,
    total: "23.68",
    currency: "GBP",
    exchangeRateToGBP: "1",
    date: new Date(),
    splitFolderId: folderA.id,
  });
  receiptIds.push(receiptA.id);
  const itemA = await storage.createReceiptItem({
    receiptId: receiptA.id,
    name: "Folder A item",
    quantity: "1",
    price: "10.00",
  });
  itemIds.push(itemA.id);

  const receiptB = await storage.createReceipt({
    userId: users.owner,
    merchantName: `Split route foreign receipt ${runId}`,
    total: "12.34",
    currency: "GBP",
    exchangeRateToGBP: "1",
    date: new Date(),
    splitFolderId: folderB.id,
  });
  receiptIds.push(receiptB.id);
  const itemB = await storage.createReceiptItem({
    receiptId: receiptB.id,
    name: "Foreign receipt item",
    quantity: "1",
    price: "12.34",
  });
  itemIds.push(itemB.id);

  const receiptA2 = await storage.createReceipt({
    userId: users.owner,
    merchantName: `Split route same-folder second receipt ${runId}`,
    total: "7.50",
    currency: "GBP",
    exchangeRateToGBP: "1",
    date: new Date(),
    splitFolderId: folderA.id,
  });
  receiptIds.push(receiptA2.id);
  const itemA2 = await storage.createReceiptItem({
    receiptId: receiptA2.id,
    name: "Same-folder different receipt item",
    quantity: "1",
    price: "7.50",
  });
  itemIds.push(itemA2.id);

  const contributorReceipt = await storage.createReceipt({
    userId: users.contributor,
    merchantName: `Split route contributor receipt ${runId}`,
    total: "2.50",
    currency: "GBP",
    exchangeRateToGBP: "1",
    date: new Date(),
    splitFolderId: null,
  });
  receiptIds.push(contributorReceipt.id);

  let protectedExpenseId = "";

  await test("Viewer can read but cannot add, edit, or manage", async () => {
    assertStatus(await api(users.viewer, "GET", `/api/split-folders/${folderA.id}`), 200, "viewer read");
    assertStatus(await api(users.viewer, "GET", `/api/split-folders/${folderA.id}/activity`), 200, "viewer activity read");
    assertStatus(await api(users.viewer, "GET", `/api/split-folders/${folderA.id}/bills`), 200, "viewer bill read");
    assertStatus(
      await api(users.viewer, "POST", `/api/split-folders/${folderA.id}/expenses`, {
        description: "Viewer must not create this",
        amount: "1.00",
      }),
      403,
      "viewer add",
    );
    assertStatus(
      await api(users.viewer, "PUT", `/api/split-folders/${folderA.id}/receipts/${receiptA.id}/assignments`, {
        mode: "whole",
        assignments: [{ memberId: viewerMember.id, itemId: null, shareAmount: "1.00" }],
      }),
      403,
      "viewer edit",
    );
    assertStatus(
      await api(users.viewer, "PATCH", `/api/split-folders/${folderA.id}`, { name: "Viewer rename" }),
      403,
      "viewer manage",
    );
  });

  await test("Contributor can add but cannot edit or manage", async () => {
    assertStatus(await api(users.contributor, "GET", `/api/split-folders/${folderA.id}`), 200, "contributor read");
    assertStatus(
      await api(users.contributor, "POST", `/api/split-folders/${folderA.id}/receipts`, {
        receiptId: contributorReceipt.id,
      }),
      200,
      "contributor receipt attach",
    );
    const created = await api(users.contributor, "POST", `/api/split-folders/${folderA.id}/expenses`, {
      description: "Contributor-created expense",
      amount: "3.00",
    });
    assertStatus(created, 201, "contributor add");
    assertStatus(
      await api(users.contributor, "PATCH", `/api/split-folders/${folderA.id}/expenses/${created.data.id}`, {
        description: "Contributor edit attempt",
      }),
      403,
      "contributor edit",
    );
    assertStatus(
      await api(users.contributor, "PUT", `/api/split-folders/${folderA.id}/receipts/${receiptA.id}/assignments`, {
        mode: "whole",
        assignments: [{ memberId: viewerMember.id, itemId: null, shareAmount: "1.00" }],
      }),
      403,
      "contributor assignment edit",
    );
    assertStatus(
      await api(users.contributor, "POST", `/api/split-folders/${folderA.id}/bills`, {
        title: "Contributor bill attempt",
        amount: "1.00",
        splitMode: "equal",
        participants: [{ memberId: viewerMember.id }],
      }),
      403,
      "contributor bill edit",
    );
    assertStatus(
      await api(users.contributor, "PATCH", `/api/split-folders/${folderA.id}`, { name: "Contributor rename" }),
      403,
      "contributor manage",
    );
  });

  await test("Editor can add and edit but cannot manage", async () => {
    assertStatus(await api(users.editor, "GET", `/api/split-folders/${folderA.id}`), 200, "editor read");
    const created = await api(users.editor, "POST", `/api/split-folders/${folderA.id}/expenses`, {
      description: "Editor-created expense",
      amount: "4.00",
    });
    assertStatus(created, 201, "editor add");
    assertStatus(
      await api(users.editor, "PATCH", `/api/split-folders/${folderA.id}/expenses/${created.data.id}`, {
        description: "Editor-updated expense",
      }),
      200,
      "editor edit",
    );
    assertStatus(
      await api(users.editor, "PUT", `/api/split-folders/${folderA.id}/receipts/${receiptA.id}/assignments`, {
        mode: "whole",
        assignments: [{ memberId: viewerMember.id, itemId: null, shareAmount: "1.00" }],
      }),
      200,
      "editor assignment edit",
    );
    assertStatus(
      await api(users.editor, "PATCH", `/api/split-folders/${folderA.id}/receipts/${receiptA.id}/items/${itemA.id}`, {
        name: "Editor-updated item",
        price: "9.50",
      }),
      200,
      "editor receipt item edit",
    );
    assertStatus(
      await api(users.editor, "PATCH", `/api/split-folders/${folderA.id}`, { name: "Editor rename" }),
      403,
      "editor manage",
    );
  });

  await test("Owner can read, add, edit, and manage", async () => {
    assertStatus(await api(users.owner, "GET", `/api/split-folders/${folderA.id}`), 200, "owner read");
    const created = await api(users.owner, "POST", `/api/split-folders/${folderA.id}/expenses`, {
      description: "Protected owner expense",
      amount: "5.00",
      allocations: [{ memberId: viewerMember.id, shareAmount: "5.00" }],
    });
    assertStatus(created, 201, "owner add");
    protectedExpenseId = created.data.id;
    assertStatus(
      await api(users.owner, "PATCH", `/api/split-folders/${folderA.id}/expenses/${protectedExpenseId}`, {
        description: "Protected owner expense updated",
      }),
      200,
      "owner edit",
    );
    assertStatus(
      await api(users.owner, "PATCH", `/api/split-folders/${folderA.id}`, {
        name: `Split route permissions updated ${runId}`,
      }),
      200,
      "owner manage",
    );
  });

  await test("Cross-folder expense access is rejected without mutating the source", async () => {
    const foreignExpense = await api(users.owner, "POST", `/api/split-folders/${folderB.id}/expenses`, {
      description: "Foreign expense",
      amount: "8.00",
    });
    assertStatus(foreignExpense, 201, "foreign expense setup");
    assertStatus(
      await api(users.editor, "PATCH", `/api/split-folders/${folderA.id}/expenses/${foreignExpense.data.id}`, {
        description: "Cross-folder mutation",
      }),
      404,
      "cross-folder expense patch",
    );
    assertStatus(
      await api(users.editor, "DELETE", `/api/split-folders/${folderA.id}/expenses/${foreignExpense.data.id}`),
      404,
      "cross-folder expense delete",
    );
    const remaining = await splitFolderStorage.listManualExpenses(folderB.id);
    assert.equal(remaining.find((expense) => expense.id === foreignExpense.data.id)?.description, "Foreign expense");
    assertStatus(
      await api(users.outsider, "GET", `/api/split-folders/${folderB.id}`),
      404,
      "non-member folder access",
    );
  });

  await test("Receipt assignment routes reject unknown and cross-receipt item IDs", async () => {
    assertStatus(
      await api(users.editor, "PUT", `/api/split-folders/${folderA.id}/receipts/${receiptA.id}/assignments`, {
        mode: "items",
        assignments: [{ memberId: viewerMember.id, itemId: randomUUID(), shareAmount: "1.00" }],
      }),
      400,
      "unknown item assignment",
    );
    assertStatus(
      await api(users.editor, "PUT", `/api/split-folders/${folderA.id}/receipts/${receiptA.id}/assignments`, {
        mode: "items",
        assignments: [{ memberId: viewerMember.id, itemId: itemB.id, shareAmount: "1.00" }],
      }),
      400,
      "cross-receipt item assignment",
    );
    assertStatus(
      await api(users.editor, "PUT", `/api/split-folders/${folderA.id}/receipts/${receiptA.id}/assignments`, {
        mode: "items",
        assignments: [{ memberId: viewerMember.id, itemId: itemA2.id, shareAmount: "1.00" }],
      }),
      400,
      "same-folder wrong-receipt item assignment",
    );
    assertStatus(
      await api(users.editor, "PATCH", `/api/split-folders/${folderA.id}/receipts/${receiptA.id}/items/${itemA2.id}`, {
        name: "Same-folder IDOR mutation",
        price: "1.00",
      }),
      404,
      "same-folder wrong-receipt item edit",
    );
    assertStatus(
      await api(users.editor, "PATCH", `/api/split-folders/${folderA.id}/receipts/${receiptA.id}/items/${randomUUID()}`, {
        name: "Unknown item mutation",
        price: "1.00",
      }),
      404,
      "unknown receipt item edit",
    );
    assertStatus(
      await api(users.editor, "PATCH", `/api/split-folders/${folderA.id}/receipts/${receiptB.id}/items/${itemB.id}`, {
        name: "IDOR mutation",
        price: "1.00",
      }),
      404,
      "cross-folder item edit",
    );
    const [unchanged] = await storage.getReceiptItems(receiptB.id);
    assert.equal(unchanged.name, "Foreign receipt item");
    assert.equal(unchanged.price, "12.34");
    const [sameFolderUnchanged] = await storage.getReceiptItems(receiptA2.id);
    assert.equal(sameFolderUnchanged.name, "Same-folder different receipt item");
    assert.equal(sameFolderUnchanged.price, "7.50");
  });

  await test("Paid allocations cannot be changed, detached, moved, deleted, or removed implicitly", async () => {
    assertStatus(
      await api(users.owner, "PUT", `/api/split-folders/${folderA.id}/receipts/${receiptA.id}/assignments`, {
        mode: "whole",
        assignments: [{ memberId: viewerMember.id, itemId: null, shareAmount: "6.69" }],
      }),
      200,
      "paid receipt setup",
    );
    assertStatus(
      await api(users.owner, "POST", `/api/split-folders/${folderA.id}/members/${viewerMember.id}/settle`),
      200,
      "owner settlement",
    );
    const paidAssignments = await splitFolderStorage.listAssignments(folderA.id);
    assert.equal(
      paidAssignments.find((assignment) => assignment.receiptId === receiptA.id)?.status,
      "paid",
      "receipt assignment fixture was not settled",
    );
    assert.equal(
      paidAssignments.find((assignment) => assignment.sourceType === "expense" && assignment.sourceId === protectedExpenseId)?.status,
      "paid",
      "expense assignment fixture was not settled",
    );
    assertStatus(
      await api(users.editor, "PUT", `/api/split-folders/${folderA.id}/receipts/${receiptA.id}/assignments`, {
        mode: "whole",
        assignments: [{ memberId: viewerMember.id, itemId: null, shareAmount: "5.00" }],
      }),
      400,
      "paid assignment edit",
    );
    assertStatus(
      await api(users.editor, "PUT", `/api/split-folders/${folderA.id}/receipts/${receiptA.id}/assignments`, {
        mode: "whole",
        assignments: [],
      }),
      400,
      "paid assignment removal",
    );
    assertStatus(
      await api(users.owner, "DELETE", `/api/split-folders/${folderA.id}/receipts/${receiptA.id}`),
      409,
      "paid receipt detach",
    );
    assertStatus(
      await api(users.owner, "POST", `/api/split-folders/${folderB.id}/receipts`, { receiptId: receiptA.id }),
      409,
      "paid receipt move",
    );
    assertStatus(
      await api(users.owner, "DELETE", `/api/split-folders/${folderA.id}/expenses/${protectedExpenseId}`),
      409,
      "paid expense delete",
    );
    assertStatus(
      await api(users.owner, "DELETE", `/api/split-folders/${folderA.id}/members/${viewerMember.id}`),
      409,
      "member removal with paid shares",
    );
    assertStatus(
      await api(users.editor, "POST", `/api/split-folders/${folderA.id}/members/${viewerMember.id}/unsettle`),
      403,
      "editor cannot unsettle",
    );
    assertStatus(
      await api(users.owner, "POST", `/api/split-folders/${folderA.id}/members/${viewerMember.id}/unsettle`),
      200,
      "owner explicit unsettle",
    );
    assertStatus(
      await api(users.owner, "DELETE", `/api/split-folders/${folderA.id}/expenses/${protectedExpenseId}`),
      200,
      "expense deletion after explicit unsettle",
    );
  });

  await test("Participants cannot self-settle bill shares", async () => {
    const bill = await api(users.editor, "POST", `/api/split-folders/${folderA.id}/bills`, {
      title: "Authorization bill",
      amount: "4.20",
      splitMode: "equal",
      participants: [{ memberId: viewerMember.id }],
    });
    assertStatus(bill, 201, "editor bill creation");
    billIds.push(bill.data.id);
    const participant = bill.data.participants[0];
    const path = `/api/split-folders/${folderA.id}/bills/${bill.data.id}/participants/${participant.id}`;
    assertStatus(await api(users.viewer, "PATCH", path, { status: "paid" }), 403, "participant self-settlement");
    assertStatus(await api(users.viewer, "PATCH", path, { status: "pending" }), 403, "participant reopen");
    assertStatus(await api(users.editor, "PATCH", path, { status: "paid" }), 403, "editor settlement");
    assertStatus(await api(users.viewer, "PATCH", path, { status: "declined" }), 200, "participant decline");
    const afterDecline = await api(users.viewer, "GET", `/api/split-folders/${folderA.id}/bills`);
    assert.equal(afterDecline.data[0].participants[0].status, "declined");
    assertStatus(await api(users.owner, "PATCH", path, { status: "pending" }), 200, "owner reopen");
    assertStatus(await api(users.owner, "PATCH", path, { status: "paid" }), 200, "owner settlement");
    const afterSettlement = await api(users.owner, "GET", `/api/split-folders/${folderA.id}/bills`);
    assert.equal(afterSettlement.data[0].participants[0].status, "paid");
    assert.equal(afterSettlement.data[0].status, "settled");
  });

  await test("Invite acceptance notifies the owner and records the join exactly once", async () => {
    const joiningUserId = `split-route-joiner-${runId}`;
    const invited = await splitFolderStorage.createMember({
      folderId: folderA.id,
      userId: joiningUserId,
      inviteEmail: `${joiningUserId}@example.invalid`,
      displayName: "Joined Friend",
      inviteToken: `split-route-join-once-${runId}`,
      status: "invited",
      role: "viewer",
    });
    const emailCount = deliveredEmails.length;

    const accepted = await api(
      joiningUserId,
      "POST",
      `/api/split-folders/invites/${invited.inviteToken}/accept`,
    );
    assertStatus(accepted, 200, "first invite acceptance");

    const activated = await splitFolderStorage.getMember(invited.id);
    assert.equal(activated?.status, "active");
    assert.equal(activated?.userId, joiningUserId);
    assert.ok(activated?.joinedAt, "accepted invite did not record joinedAt");
    assert.equal(deliveredEmails.length, emailCount + 1);
    assert.equal(
      deliveredEmails.at(-1)?.to,
      `split-route-owner-${runId}@example.invalid`,
    );
    assert.match(deliveredEmails.at(-1)?.subject || "", /joined/i);
    assert.match(deliveredEmails.at(-1)?.text || "", new RegExp(runId));

    const joinedEvents = (await splitFolderStorage.listActivity(folderA.id)).filter(
      (event) =>
        event.eventType === "member.joined" &&
        (event.metadata as { memberId?: string } | null)?.memberId === invited.id,
    );
    assert.equal(joinedEvents.length, 1);

    assertStatus(
      await api(joiningUserId, "POST", `/api/split-folders/invites/${invited.inviteToken}/accept`),
      200,
      "repeat invite acceptance",
    );
    assert.equal(deliveredEmails.length, emailCount + 1, "repeat acceptance sent another owner email");
    const repeatedEvents = (await splitFolderStorage.listActivity(folderA.id)).filter(
      (event) =>
        event.eventType === "member.joined" &&
        (event.metadata as { memberId?: string } | null)?.memberId === invited.id,
    );
    assert.equal(repeatedEvents.length, 1, "repeat acceptance created another join event");
  });

  await test("Concurrent acceptance produces one owner notification", async () => {
    const joiningUserId = `split-route-concurrent-joiner-${runId}`;
    const invited = await splitFolderStorage.createMember({
      folderId: folderA.id,
      userId: joiningUserId,
      inviteEmail: `${joiningUserId}@example.invalid`,
      displayName: "Concurrent Friend",
      inviteToken: `split-route-concurrent-${runId}`,
      status: "invited",
      role: "viewer",
    });
    const emailCount = deliveredEmails.length;
    const path = `/api/split-folders/invites/${invited.inviteToken}/accept`;
    const results = await Promise.all([
      api(joiningUserId, "POST", path),
      api(joiningUserId, "POST", path),
    ]);
    results.forEach((result, index) =>
      assertStatus(result, 200, `concurrent invite acceptance ${index + 1}`),
    );
    assert.equal(deliveredEmails.length, emailCount + 1);
    const joinedEvents = (await splitFolderStorage.listActivity(folderA.id)).filter(
      (event) =>
        event.eventType === "member.joined" &&
        (event.metadata as { memberId?: string } | null)?.memberId === invited.id,
    );
    assert.equal(joinedEvents.length, 1);
  });

  await test("Wrong-account and revoked invite attempts never notify the owner", async () => {
    const expectedUserId = `split-route-expected-joiner-${runId}`;
    const invited = await splitFolderStorage.createMember({
      folderId: folderA.id,
      userId: expectedUserId,
      inviteEmail: `${expectedUserId}@example.invalid`,
      displayName: "Expected Friend",
      inviteToken: `split-route-wrong-account-${runId}`,
      status: "invited",
      role: "viewer",
    });
    const revoked = await splitFolderStorage.createMember({
      folderId: folderA.id,
      userId: `split-route-revoked-${runId}`,
      inviteEmail: `split-route-revoked-${runId}@example.invalid`,
      displayName: "Revoked Friend",
      inviteToken: `split-route-revoked-${runId}`,
      status: "removed",
      role: "viewer",
    });
    const emailCount = deliveredEmails.length;
    assertStatus(
      await api(users.outsider, "POST", `/api/split-folders/invites/${invited.inviteToken}/accept`),
      403,
      "wrong-account invite acceptance",
    );
    assertStatus(
      await api(revoked.userId!, "POST", `/api/split-folders/invites/${revoked.inviteToken}/accept`),
      410,
      "revoked invite acceptance",
    );
    assert.equal(deliveredEmails.length, emailCount);
    assert.equal((await splitFolderStorage.getMember(invited.id))?.status, "invited");
  });

  await test("Notification failure never rolls back a successful join", async () => {
    const joiningUserId = `split-route-failed-email-joiner-${runId}`;
    const invited = await splitFolderStorage.createMember({
      folderId: folderA.id,
      userId: joiningUserId,
      inviteEmail: `${joiningUserId}@example.invalid`,
      displayName: "Failure-safe Friend",
      inviteToken: `split-route-failed-email-${runId}`,
      status: "invited",
      role: "viewer",
    });
    const emailCount = deliveredEmails.length;
    failNextEmail = true;
    assertStatus(
      await api(joiningUserId, "POST", `/api/split-folders/invites/${invited.inviteToken}/accept`),
      200,
      "invite acceptance with failed owner email",
    );
    assert.equal(deliveredEmails.length, emailCount + 1);
    assert.equal((await splitFolderStorage.getMember(invited.id))?.status, "active");
    assert.equal(
      (await splitFolderStorage.listActivity(folderA.id)).filter(
        (event) =>
          event.eventType === "member.joined" &&
          (event.metadata as { memberId?: string } | null)?.memberId === invited.id,
      ).length,
      1,
    );

    const throwingUserId = `split-route-throwing-email-joiner-${runId}`;
    const throwingInvite = await splitFolderStorage.createMember({
      folderId: folderA.id,
      userId: throwingUserId,
      inviteEmail: `${throwingUserId}@example.invalid`,
      displayName: "Exception-safe Friend",
      inviteToken: `split-route-throwing-email-${runId}`,
      status: "invited",
      role: "viewer",
    });
    throwNextEmail = true;
    assertStatus(
      await api(
        throwingUserId,
        "POST",
        `/api/split-folders/invites/${throwingInvite.inviteToken}/accept`,
      ),
      200,
      "invite acceptance with thrown owner email error",
    );
    assert.equal((await splitFolderStorage.getMember(throwingInvite.id))?.status, "active");
  });

  await test("A missing owner email does not prevent invite acceptance", async () => {
    const joiningUserId = `split-route-no-owner-email-${runId}`;
    const invited = await splitFolderStorage.createMember({
      folderId: folderB.id,
      userId: joiningUserId,
      inviteEmail: `${joiningUserId}@example.invalid`,
      displayName: "No-email Friend",
      inviteToken: `split-route-no-owner-email-${runId}`,
      status: "invited",
      role: "viewer",
    });
    const emailCount = deliveredEmails.length;
    assertStatus(
      await api(joiningUserId, "POST", `/api/split-folders/invites/${invited.inviteToken}/accept`),
      200,
      "invite acceptance without owner email",
    );
    assert.equal(deliveredEmails.length, emailCount);
    assert.equal((await splitFolderStorage.getMember(invited.id))?.status, "active");
  });

  assert.equal(ownerMember.role, "owner");
}

async function runSuite() {
  try {
    await main();
  } finally {
    await cleanup();
  }
}

runSuite().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });