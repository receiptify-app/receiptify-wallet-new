import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { type Server } from "node:http";
import express from "express";
import { eq, inArray, sql } from "drizzle-orm";
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
  splitShareLinks,
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

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function queueFinancialRace(
  memberId: string,
  first: () => Promise<ApiResult>,
  second: () => Promise<ApiResult>,
): Promise<[ApiResult, ApiResult]> {
  let results!: Promise<[ApiResult, ApiResult]>;
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select id from split_folder_members where id = ${memberId} for update`,
    );
    const firstRequest = first();
    await delay(100);
    const secondRequest = second();
    await delay(150);
    results = Promise.all([firstRequest, secondRequest]);
  });
  return results;
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
      db.select({ id: splitShareLinks.id }).from(splitShareLinks).where(inArray(splitShareLinks.folderId, folderIds)),
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

  const balanceFolder = await splitFolderStorage.createFolder({
    ownerId: users.owner,
    name: `Split route balances ${runId}`,
    description: "Disposable canonical balance fixture",
    workspaceType: "ongoing",
  });
  folderIds.push(balanceFolder.id);

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
  const balanceOwner = await splitFolderStorage.createMember({
    folderId: balanceFolder.id,
    userId: users.owner,
    displayName: "Balance Owner",
    inviteToken: `split-route-balance-owner-${runId}`,
    status: "active",
    role: "owner",
  });
  const balanceInvited = await splitFolderStorage.createMember({
    folderId: balanceFolder.id,
    displayName: "Invited Friend",
    inviteEmail: `split-route-balance-invited-${runId}@example.invalid`,
    inviteToken: `split-route-balance-invited-${runId}`,
    status: "invited",
    role: "viewer",
  });
  const balancePaidMember = await splitFolderStorage.createMember({
    folderId: balanceFolder.id,
    displayName: "Paid Bill Friend",
    inviteEmail: `split-route-balance-paid-${runId}@example.invalid`,
    inviteToken: `split-route-balance-paid-${runId}`,
    status: "invited",
    role: "viewer",
  });
  const balanceDeclinedMember = await splitFolderStorage.createMember({
    folderId: balanceFolder.id,
    displayName: "Declined Bill Friend",
    inviteEmail: `split-route-balance-declined-${runId}@example.invalid`,
    inviteToken: `split-route-balance-declined-${runId}`,
    status: "invited",
    role: "viewer",
  });
  const balanceRaceMember = await splitFolderStorage.createMember({
    folderId: balanceFolder.id,
    displayName: "Concurrent Friend",
    inviteEmail: `split-route-balance-race-${runId}@example.invalid`,
    inviteToken: `split-route-balance-race-${runId}`,
    status: "invited",
    role: "viewer",
  });
  const balanceDeclineRaceMember = await splitFolderStorage.createMember({
    folderId: balanceFolder.id,
    displayName: "Decline Race Friend",
    inviteEmail: `split-route-balance-decline-race-${runId}@example.invalid`,
    inviteToken: `split-route-balance-decline-race-${runId}`,
    status: "invited",
    role: "viewer",
  });
  const balancePendingRaceMember = await splitFolderStorage.createMember({
    folderId: balanceFolder.id,
    displayName: "Pending Race Friend",
    inviteEmail: `split-route-balance-pending-race-${runId}@example.invalid`,
    inviteToken: `split-route-balance-pending-race-${runId}`,
    status: "invited",
    role: "viewer",
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

  const balanceReceipt = await storage.createReceipt({
    userId: users.owner,
    merchantName: `Screwfix balance fixture ${runId}`,
    total: "23.68",
    currency: "GBP",
    exchangeRateToGBP: "1",
    date: new Date(),
    splitFolderId: balanceFolder.id,
  });
  receiptIds.push(balanceReceipt.id);

  let protectedExpenseId = "";

  await test("Secure share links use hashed tokens, scoped metadata, revocation, and safe failures", async () => {
    const forbidden = await api(users.outsider, "POST", `/api/split-folders/${folderA.id}/shares`, {
      entityType: "receipt",
      entityId: receiptA.id,
    });
    assertStatus(forbidden, 403, "outsider cannot share a private folder");

    const created = await api(users.owner, "POST", `/api/split-folders/${folderA.id}/shares`, {
      entityType: "receipt",
      entityId: receiptA.id,
    });
    assertStatus(created, 201, "owner creates receipt share");
    assert.equal(created.data.title.includes(receiptA.merchantName), true);
    assert.equal(created.data.url.includes("/split/share/"), true);
    const sharePath = new URL(created.data.url).pathname;
    const token = sharePath.split("/").pop()!;

    const [stored] = await db.select().from(splitShareLinks).where(eq(splitShareLinks.id, created.data.id));
    assert.ok(stored);
    assert.equal(stored.tokenHash.length, 64);
    assert.notEqual(stored.tokenHash, token, "raw bearer token must never be stored");

    const listed = await api(users.owner, "GET", `/api/split-folders/${folderA.id}/shares`);
    assertStatus(listed, 200, "owner lists active share links");
    const listedShare = listed.data.find((candidate: any) => candidate.id === created.data.id);
    assert.ok(listedShare, "created link remains manageable after its raw URL response is gone");
    assert.equal(listedShare.label, receiptA.merchantName);
    assert.equal("tokenHash" in listedShare, false);
    assert.equal("url" in listedShare, false);
    const outsiderList = await api(users.outsider, "GET", `/api/split-folders/${folderA.id}/shares`);
    assertStatus(outsiderList, 403, "outsider cannot list active share links");

    const previewResponse = await fetch(`${baseUrl}${sharePath}`);
    const previewHtml = await previewResponse.text();
    assert.equal(previewResponse.status, 200);
    assert.equal(previewResponse.headers.get("cache-control"), "private, no-store");
    assert.match(previewHtml, /property="og:title"/);
    assert.match(previewHtml, /rel="canonical"/);
    assert.match(previewHtml, /twitter:card/);
    assert.match(previewHtml, new RegExp(receiptA.merchantName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(previewHtml, /£23\.68/);
    assert.doesNotMatch(previewHtml, /Folder A item/, "public preview must not expose receipt line items");
    assert.doesNotMatch(previewHtml, new RegExp(folderA.description!), "public preview must not expose folder description");
    assert.doesNotMatch(previewHtml, /example\.invalid/, "public preview must not expose member emails");

    const tamperedToken = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
    const tampered = await fetch(`${baseUrl}/split/share/${tamperedToken}`);
    const tamperedHtml = await tampered.text();
    assert.equal(tampered.status, 404);
    assert.doesNotMatch(tamperedHtml, new RegExp(receiptA.merchantName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(tamperedHtml, /£23\.68/);

    const outsiderRevoke = await api(users.outsider, "DELETE", `/api/split-folders/${folderA.id}/shares/${listedShare.id}`);
    assertStatus(outsiderRevoke, 403, "outsider cannot revoke share links");
    const revoked = await api(users.owner, "DELETE", `/api/split-folders/${folderA.id}/shares/${listedShare.id}`);
    assertStatus(revoked, 200, "owner revokes share");
    const revokedResponse = await fetch(`${baseUrl}${sharePath}`);
    const revokedHtml = await revokedResponse.text();
    assert.equal(revokedResponse.status, 410);
    assert.doesNotMatch(revokedHtml, new RegExp(receiptA.merchantName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

    const expiredToken = `expired-share-${runId}`;
    await splitFolderStorage.createShareLink({
      folderId: folderA.id,
      entityType: "receipt",
      entityId: receiptA.id,
      token: expiredToken,
      createdBy: users.owner,
      expiresAt: new Date(Date.now() - 1000),
    });
    const expiredResponse = await fetch(`${baseUrl}/split/share/${expiredToken}`);
    const expiredHtml = await expiredResponse.text();
    assert.equal(expiredResponse.status, 410);
    assert.doesNotMatch(expiredHtml, new RegExp(receiptA.merchantName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

    const missing = await fetch(`${baseUrl}/split/share/${"missing-secure-share-token-000"}`);
    assert.equal(missing.status, 404);
  });

  await test("Generated folder invites return a native-share payload without exposing the token field", async () => {
    const generated = await api(users.owner, "POST", `/api/split-folders/${folderA.id}/members`, {
      displayName: "Share Link Friend",
      generateLinkOnly: true,
    });
    assertStatus(generated, 201, "generate invite share");
    assert.equal("inviteToken" in generated.data, false);
    assert.equal(typeof generated.data.share?.title, "string");
    assert.equal(typeof generated.data.share?.text, "string");
    assert.equal(generated.data.share?.url.includes("/split/share/"), true);

    const previewPath = new URL(generated.data.share.url).pathname;
    const token = previewPath.split("/").pop()!;
    const response = await fetch(`${baseUrl}${previewPath}`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /Join Split route permissions/);
    assert.match(html, /property="og:title"/);
    assert.doesNotMatch(html, /Disposable route-level authorization fixture/);
    assert.doesNotMatch(html, /Share Link Friend/);

    const legacyApi = await fetch(`${baseUrl}/api/split-folders/invites/${token}`);
    const legacyPreview = await legacyApi.json();
    assert.equal(legacyApi.status, 200);
    assert.deepEqual(Object.keys(legacyPreview).sort(), ["alreadyActive", "folderName"]);
    assert.equal(JSON.stringify(legacyPreview).includes("Disposable route-level authorization fixture"), false);
  });

  await test("Canonical summaries count source spend once and permit invited allocations", async () => {
    const initial = await api(users.owner, "GET", `/api/split-folders/${balanceFolder.id}`);
    assertStatus(initial, 200, "initial balance detail");
    assert.deepEqual(
      {
        totalSpent: initial.data.totalSpent,
        allocatedAmount: initial.data.allocatedAmount,
        paidAmount: initial.data.paidAmount,
        outstandingAmount: initial.data.outstandingAmount,
        personalAmount: initial.data.personalAmount,
        receiptCount: initial.data.receiptCount,
      },
      {
        totalSpent: 23.68,
        allocatedAmount: 0,
        paidAmount: 0,
        outstandingAmount: 0,
        personalAmount: 23.68,
        receiptCount: 1,
      },
    );

    assertStatus(
      await api(users.owner, "PUT", `/api/split-folders/${balanceFolder.id}/receipts/${balanceReceipt.id}/assignments`, {
        mode: "whole",
        assignments: [{ memberId: balanceInvited.id, itemId: null, shareAmount: "6.69" }],
      }),
      200,
      "invited receipt allocation",
    );
    const screwfix = await api(users.owner, "GET", `/api/split-folders/${balanceFolder.id}`);
    assert.equal(screwfix.data.totalSpent, 23.68);
    assert.equal(screwfix.data.allocatedAmount, 6.69);
    assert.equal(screwfix.data.paidAmount, 0);
    assert.equal(screwfix.data.outstandingAmount, 6.69);
    assert.equal(screwfix.data.personalAmount, 16.99);
    assert.equal(screwfix.data.totalAmount, 23.68, "compatibility total must now mean source spend");

    const list = await api(users.owner, "GET", "/api/split-folders");
    assertStatus(list, 200, "folder summaries");
    const listSummary = list.data.find((folder: any) => folder.id === balanceFolder.id);
    assert.equal(listSummary.totalSpent, 23.68);
    assert.equal(listSummary.allocatedAmount, 6.69);
    assert.equal(listSummary.personalAmount, 16.99);

    assertStatus(
      await api(users.owner, "POST", `/api/split-folders/${balanceFolder.id}/members/${balanceInvited.id}/settle`),
      200,
      "settle invited receipt share",
    );
    const settled = await api(users.owner, "GET", `/api/split-folders/${balanceFolder.id}`);
    assert.equal(settled.data.totalSpent, 23.68);
    assert.equal(settled.data.allocatedAmount, 6.69);
    assert.equal(settled.data.paidAmount, 6.69);
    assert.equal(settled.data.outstandingAmount, 0);
    assert.equal(settled.data.personalAmount, 16.99);
    assertStatus(
      await api(users.owner, "POST", `/api/split-folders/${balanceFolder.id}/members/${balanceInvited.id}/unsettle`),
      200,
      "reopen invited receipt share",
    );

    const expense = await api(users.owner, "POST", `/api/split-folders/${balanceFolder.id}/expenses`, {
      description: "Party Food",
      amount: "120.00",
      payerMemberId: balanceOwner.id,
      allocations: [{ memberId: balanceInvited.id, shareAmount: "50.00" }],
    });
    assertStatus(expense, 201, "invited expense allocation");

    const bill = await api(users.owner, "POST", `/api/split-folders/${balanceFolder.id}/bills`, {
      title: "One-off-style bill",
      amount: "10.00",
      splitMode: "custom",
      participants: [
        { memberId: balanceOwner.id, shareAmount: "4.00" },
        { memberId: balanceInvited.id, shareAmount: "6.00" },
      ],
    });
    assertStatus(bill, 201, "invited bill allocation");
    billIds.push(bill.data.id);

    const combined = await api(users.owner, "GET", `/api/split-folders/${balanceFolder.id}`);
    assert.equal(combined.data.totalSpent, 153.68);
    assert.equal(combined.data.allocatedAmount, 62.69);
    assert.equal(combined.data.paidAmount, 0);
    assert.equal(combined.data.outstandingAmount, 62.69);
    assert.equal(combined.data.personalAmount, 90.99);
    const ownerSettlement = combined.data.settlement.find((entry: any) => entry.memberId === balanceOwner.id);
    assert.equal(ownerSettlement.paidUpfront, 153.68);
    assert.equal(ownerSettlement.personal, 90.99);
    assert.equal(ownerSettlement.outstandingToReceive, 62.69);

    assertStatus(
      await api(users.owner, "DELETE", `/api/split-folders/${balanceFolder.id}/expenses/${expense.data.id}`),
      200,
      "delete pending expense",
    );
    const afterDelete = await api(users.owner, "GET", `/api/split-folders/${balanceFolder.id}`);
    assert.equal(afterDelete.data.totalSpent, 33.68);
    assert.equal(afterDelete.data.allocatedAmount, 12.69);
    assert.equal(afterDelete.data.outstandingAmount, 12.69);
    assert.equal(afterDelete.data.personalAmount, 20.99);

    assertStatus(
      await api(users.owner, "DELETE", `/api/split-folders/${balanceFolder.id}/members/${balanceInvited.id}`),
      200,
      "remove member with pending receipt and bill shares",
    );
    const afterPendingRemoval = await api(users.owner, "GET", `/api/split-folders/${balanceFolder.id}`);
    assert.equal(afterPendingRemoval.data.totalSpent, 33.68);
    assert.equal(afterPendingRemoval.data.allocatedAmount, 0);
    assert.equal(afterPendingRemoval.data.paidAmount, 0);
    assert.equal(afterPendingRemoval.data.outstandingAmount, 0);
    assert.equal(afterPendingRemoval.data.personalAmount, 33.68);
    assert.equal(
      afterPendingRemoval.data.settlement.some((entry: any) => entry.memberId === balanceInvited.id),
      false,
    );
    const billsAfterRemoval = await api(users.owner, "GET", `/api/split-folders/${balanceFolder.id}/bills`);
    const removedParticipant = billsAfterRemoval.data
      .flatMap((entry: any) => entry.participants)
      .find((participant: any) => participant.memberId === balanceInvited.id);
    assert.equal(removedParticipant.status, "declined");

    const paidBill = await api(users.owner, "POST", `/api/split-folders/${balanceFolder.id}/bills`, {
      title: "Paid removal guard",
      amount: "5.00",
      splitMode: "equal",
      participants: [{ memberId: balancePaidMember.id }],
    });
    assertStatus(paidBill, 201, "paid removal bill setup");
    billIds.push(paidBill.data.id);
    const paidParticipant = paidBill.data.participants[0];
    assertStatus(
      await api(
        users.owner,
        "PATCH",
        `/api/split-folders/${balanceFolder.id}/bills/${paidBill.data.id}/participants/${paidParticipant.id}`,
        { status: "paid" },
      ),
      200,
      "paid removal participant setup",
    );
    assertStatus(
      await api(users.owner, "DELETE", `/api/split-folders/${balanceFolder.id}/members/${balancePaidMember.id}`),
      409,
      "paid bill share blocks member removal",
    );
    assertStatus(
      await api(users.owner, "POST", `/api/split-folders/${balanceFolder.id}/members/${balancePaidMember.id}/unsettle`),
      200,
      "explicitly reopen paid bill share",
    );
    assertStatus(
      await api(users.owner, "DELETE", `/api/split-folders/${balanceFolder.id}/members/${balancePaidMember.id}`),
      200,
      "member removal after bill share reopened",
    );
    const afterPaidRemoval = await api(users.owner, "GET", `/api/split-folders/${balanceFolder.id}`);
    assert.equal(afterPaidRemoval.data.totalSpent, 38.68);
    assert.equal(afterPaidRemoval.data.allocatedAmount, 0);
    assert.equal(afterPaidRemoval.data.paidAmount, 0);
    assert.equal(afterPaidRemoval.data.outstandingAmount, 0);
    assert.equal(afterPaidRemoval.data.personalAmount, 38.68);

    const declinedBill = await api(users.owner, "POST", `/api/split-folders/${balanceFolder.id}/bills`, {
      title: "Declined share stays declined",
      amount: "4.00",
      splitMode: "equal",
      participants: [{ memberId: balanceDeclinedMember.id }],
    });
    assertStatus(declinedBill, 201, "declined bill setup");
    billIds.push(declinedBill.data.id);
    const declinedParticipant = declinedBill.data.participants[0];
    assertStatus(
      await api(
        users.owner,
        "PATCH",
        `/api/split-folders/${balanceFolder.id}/bills/${declinedBill.data.id}/participants/${declinedParticipant.id}`,
        { status: "declined" },
      ),
      200,
      "decline bill share",
    );
    assertStatus(
      await api(users.owner, "POST", `/api/split-folders/${balanceFolder.id}/members/${balanceDeclinedMember.id}/settle`),
      200,
      "bulk settle after decline",
    );
    const billsAfterDeclinedSettlement = await api(users.owner, "GET", `/api/split-folders/${balanceFolder.id}/bills`);
    const stillDeclined = billsAfterDeclinedSettlement.data
      .flatMap((entry: any) => entry.participants)
      .find((participant: any) => participant.id === declinedParticipant.id);
    assert.equal(stillDeclined.status, "declined");
    const afterDeclinedSettlement = await api(users.owner, "GET", `/api/split-folders/${balanceFolder.id}`);
    assert.equal(afterDeclinedSettlement.data.totalSpent, 42.68);
    assert.equal(afterDeclinedSettlement.data.allocatedAmount, 0);
    assert.equal(afterDeclinedSettlement.data.paidAmount, 0);
    assert.equal(afterDeclinedSettlement.data.outstandingAmount, 0);
    assert.equal(afterDeclinedSettlement.data.personalAmount, 42.68);

    assertStatus(
      await api(users.owner, "PUT", `/api/split-folders/${balanceFolder.id}/receipts/${balanceReceipt.id}/assignments`, {
        mode: "whole",
        assignments: [{ memberId: balanceRaceMember.id, itemId: null, shareAmount: "2.00" }],
      }),
      200,
      "concurrent settlement fixture",
    );
    const [settleRace, removeRace] = await Promise.all([
      api(users.owner, "POST", `/api/split-folders/${balanceFolder.id}/members/${balanceRaceMember.id}/settle`),
      api(users.owner, "DELETE", `/api/split-folders/${balanceFolder.id}/members/${balanceRaceMember.id}`),
    ]);
    assert.equal(
      [settleRace.status, removeRace.status].filter((status) => status === 200).length,
      1,
      `settle/remove race must have exactly one winner: ${settleRace.status}/${removeRace.status}`,
    );
    const raceMember = await splitFolderStorage.getMember(balanceRaceMember.id);
    const raceAssignments = (await splitFolderStorage.listAssignments(balanceFolder.id))
      .filter((assignment) => assignment.memberId === balanceRaceMember.id);
    if (removeRace.status === 200) {
      assert.equal(raceMember?.status, "removed");
      assert.deepEqual(raceAssignments, []);
      assert.ok([404, 409].includes(settleRace.status));
    } else {
      assert.notEqual(raceMember?.status, "removed");
      assert.equal(settleRace.status, 200);
      assert.equal(removeRace.status, 409);
      assert.equal(raceAssignments.length, 1);
      assert.equal(raceAssignments[0].status, "paid");
    }

    const declineRaceBill = await api(users.owner, "POST", `/api/split-folders/${balanceFolder.id}/bills`, {
      title: "Settle versus decline race",
      amount: "3.00",
      splitMode: "equal",
      participants: [{ memberId: balanceDeclineRaceMember.id }],
    });
    assertStatus(declineRaceBill, 201, "decline race bill setup");
    billIds.push(declineRaceBill.data.id);
    const declineRaceParticipant = declineRaceBill.data.participants[0];
    const [settleBeforeDecline, staleDecline] = await queueFinancialRace(
      balanceDeclineRaceMember.id,
      () => api(users.owner, "POST", `/api/split-folders/${balanceFolder.id}/members/${balanceDeclineRaceMember.id}/settle`),
      () => api(
        users.owner,
        "PATCH",
        `/api/split-folders/${balanceFolder.id}/bills/${declineRaceBill.data.id}/participants/${declineRaceParticipant.id}`,
        { status: "declined" },
      ),
    );
    assertStatus(settleBeforeDecline, 200, "settlement queued before stale decline");
    assertStatus(staleDecline, 409, "stale decline must conflict");
    const declineRaceBills = await api(users.owner, "GET", `/api/split-folders/${balanceFolder.id}/bills`);
    const declineRaceFinal = declineRaceBills.data
      .flatMap((entry: any) => entry.participants)
      .find((participant: any) => participant.id === declineRaceParticipant.id);
    assert.equal(declineRaceFinal.status, "paid");

    const pendingRaceBill = await api(users.owner, "POST", `/api/split-folders/${balanceFolder.id}/bills`, {
      title: "Settle versus pending race",
      amount: "2.00",
      splitMode: "equal",
      participants: [{ memberId: balancePendingRaceMember.id }],
    });
    assertStatus(pendingRaceBill, 201, "pending race bill setup");
    billIds.push(pendingRaceBill.data.id);
    const pendingRaceParticipant = pendingRaceBill.data.participants[0];
    const [settleBeforePending, stalePending] = await queueFinancialRace(
      balancePendingRaceMember.id,
      () => api(users.owner, "POST", `/api/split-folders/${balanceFolder.id}/members/${balancePendingRaceMember.id}/settle`),
      () => api(
        users.owner,
        "PATCH",
        `/api/split-folders/${balanceFolder.id}/bills/${pendingRaceBill.data.id}/participants/${pendingRaceParticipant.id}`,
        { status: "pending" },
      ),
    );
    assertStatus(settleBeforePending, 200, "settlement queued before stale pending");
    assertStatus(stalePending, 409, "stale pending update must conflict");
    const pendingRaceBills = await api(users.owner, "GET", `/api/split-folders/${balanceFolder.id}/bills`);
    const pendingRaceFinal = pendingRaceBills.data
      .flatMap((entry: any) => entry.participants)
      .find((participant: any) => participant.id === pendingRaceParticipant.id);
    assert.equal(pendingRaceFinal.status, "paid");
  });

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

  await test("Payment-request drafts preserve their reviewed context", async () => {
    const subfolder = await splitFolderStorage.createSubfolder({
      folderId: folderA.id,
      name: "Friday dinner",
    });
    const created = await api(users.owner, "POST", `/api/split-folders/${folderA.id}/payment-requests`, {
      memberId: viewerMember.id,
      amount: "18.00",
      currency: "GBP",
      context: "Dinner at Mallow",
      message: "Please settle this when you can.",
      subfolderId: subfolder.id,
    });
    assertStatus(created, 201, "create contextual payment-request draft");
    assert.equal(created.data.status, "draft");
    assert.equal(created.data.context, "Dinner at Mallow");
    assert.equal(created.data.message, "Please settle this when you can.");
    assert.equal(created.data.subfolderId, subfolder.id);

    const listed = await api(users.owner, "GET", `/api/split-folders/${folderA.id}/payment-requests`);
    assertStatus(listed, 200, "list contextual payment-request draft");
    const request = listed.data.find((candidate: any) => candidate.id === created.data.id);
    assert.equal(request.context, "Dinner at Mallow");
    assert.equal(request.message, "Please settle this when you can.");
    assert.equal(request.subfolderId, subfolder.id);
  });

  await test("Equal one-off bills divide debt between friends, not the payer", async () => {
    const created = await api(users.owner, "POST", "/api/split-bills", {
      title: "Dinner",
      amount: "36.00",
      splitMode: "equal",
      participants: [
        { key: "creator", name: "You", isCreator: true },
        { key: "jason", name: "Jason", email: "jason@example.invalid", isCreator: false },
        { key: "darlington", name: "Darlington", email: "darlington@example.invalid", isCreator: false },
      ],
    });
    assertStatus(created, 201, "create equal one-off bill");
    folderIds.push(created.data.folderId);
    billIds.push(created.data.id);
    const participantShares = created.data.participants.map((participant: any) => Number(participant.shareAmount));
    assert.deepEqual(participantShares, [0, 18, 18]);
  });

  await test("Paid receipt shares block OCR item changes until explicitly reopened", async () => {
    assertStatus(
      await api(users.owner, "PUT", `/api/split-folders/${folderA.id}/receipts/${receiptA.id}/assignments`, {
        mode: "items",
        assignments: [{ memberId: viewerMember.id, itemId: itemA.id, shareAmount: "10.00" }],
      }),
      200,
      "create item assignment before settlement",
    );
    assertStatus(
      await api(users.owner, "POST", `/api/split-folders/${folderA.id}/members/${viewerMember.id}/settle`),
      200,
      "settle item assignment",
    );
    assertStatus(
      await api(users.owner, "PATCH", `/api/split-folders/${folderA.id}/receipts/${receiptA.id}/items/${itemA.id}`, {
        name: "Paid item must not change",
        price: "11.00",
      }),
      409,
      "paid item update guard",
    );
    assertStatus(
      await api(users.owner, "POST", `/api/split-folders/${folderA.id}/receipts/${receiptA.id}/items`, {
        name: "Paid receipt must not gain items",
        price: "1.00",
      }),
      409,
      "paid item creation guard",
    );
    const unchanged = (await storage.getReceiptItems(receiptA.id)).find((item) => item.id === itemA.id);
    assert.equal(unchanged?.name, "Folder A item");
    assert.equal(unchanged?.price, "10.00");

    assertStatus(
      await api(users.owner, "POST", `/api/split-folders/${folderA.id}/members/${viewerMember.id}/unsettle`),
      200,
      "explicitly reopen paid item assignment",
    );
    assertStatus(
      await api(users.owner, "PATCH", `/api/split-folders/${folderA.id}/receipts/${receiptA.id}/items/${itemA.id}`, {
        name: "Corrected item",
        price: "10.00",
      }),
      200,
      "edit item after reopening",
    );
    assertStatus(
      await api(users.owner, "PUT", `/api/split-folders/${folderA.id}/receipts/${receiptA.id}/assignments`, {
        mode: "items",
        assignments: [],
      }),
      200,
      "clear reopened item assignment",
    );
  });

  await test("Foreign-currency OCR edits round-trip raw values without double conversion", async () => {
    const foreignReceipt = await storage.createReceipt({
      userId: users.owner,
      merchantName: `EUR split route receipt ${runId}`,
      total: "10.00",
      currency: "EUR",
      exchangeRateToGBP: "0.85000000",
      date: new Date(),
      splitFolderId: folderA.id,
    });
    receiptIds.push(foreignReceipt.id);
    const foreignItem = await storage.createReceiptItem({
      receiptId: foreignReceipt.id,
      name: "Raw euro item",
      quantity: "1",
      price: "4.00",
    });
    itemIds.push(foreignItem.id);

    const before = await api(users.owner, "GET", `/api/split-folders/${folderA.id}`);
    const beforeItem = before.data.receipts
      .find((receipt: any) => receipt.id === foreignReceipt.id)
      .items.find((item: any) => item.id === foreignItem.id);
    assert.equal(beforeItem.rawPrice, "4.00");
    assert.equal(Number(beforeItem.price), 3.4);

    assertStatus(
      await api(users.owner, "PATCH", `/api/split-folders/${folderA.id}/receipts/${foreignReceipt.id}/items/${foreignItem.id}`, {
        name: "Corrected euro item",
        price: "5.00",
      }),
      200,
      "edit raw euro item",
    );
    const after = await api(users.owner, "GET", `/api/split-folders/${folderA.id}`);
    const afterItem = after.data.receipts
      .find((receipt: any) => receipt.id === foreignReceipt.id)
      .items.find((item: any) => item.id === foreignItem.id);
    assert.equal(afterItem.rawPrice, "5.00");
    assert.equal(Number(afterItem.price), 4.25);
  });

  await test("OCR item edits reject negative and invalid prices", async () => {
    assertStatus(
      await api(users.owner, "PATCH", `/api/split-folders/${folderA.id}/receipts/${receiptA.id}/items/${itemA.id}`, {
        price: "-0.01",
      }),
      400,
      "negative item price",
    );
    assertStatus(
      await api(users.owner, "PATCH", `/api/split-folders/${folderA.id}/receipts/${receiptA.id}/items/${itemA.id}`, {
        price: "not-a-number",
      }),
      400,
      "invalid item price",
    );
    const unchanged = (await storage.getReceiptItems(receiptA.id)).find((item) => item.id === itemA.id);
    assert.equal(unchanged?.price, "10.00");
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