import assert from "node:assert/strict";
import { allocationSummary, billStatus, canSplit, canUpdateBillParticipantStatus, validPaymentTransition, validateAllocations } from "../server/split-utils";

function run(name: string, fn: () => void) {
  try { fn(); console.log(`ok - ${name}`); }
  catch (error) { console.error(`FAIL - ${name}`, error); process.exitCode = 1; }
}

run("Screwfix £23.68 retains £16.99 personal and £6.69 outstanding", () => {
  const result = allocationSummary("23.68", [{ shareAmount: "6.69" }]);
  assert.equal(result.allocated, 6.69);
  assert.equal(result.personal, 16.99);
  assert.equal(result.isOverAllocated, false);
});

run("allocations can be partial but cannot exceed their source amount", () => {
  assert.equal(validateAllocations("10.00", [{ shareAmount: "4.00" }]), null);
  assert.match(validateAllocations("10.00", [{ shareAmount: "10.01" }]) || "", /exceed/);
});

run("legacy members are viewers and role permissions are ordered", () => {
  assert.equal(canSplit("member", "add"), false);
  assert.equal(canSplit("contributor", "add"), true);
  assert.equal(canSplit("editor", "edit"), true);
  assert.equal(canSplit("editor", "manage"), false);
});

run("bill status reflects participant settlement", () => {
  assert.equal(billStatus([{ status: "pending" }, { status: "pending" }]), "unpaid");
  assert.equal(billStatus([{ status: "paid" }, { status: "pending" }]), "partially_paid");
  assert.equal(billStatus([{ status: "paid" }, { status: "paid" }]), "settled");
});

run("payment requests only allow durable forward transitions", () => {
  assert.equal(validPaymentTransition("draft", "pending"), true);
  assert.equal(validPaymentTransition("pending", "declined"), true);
  assert.equal(validPaymentTransition("paid", "refunded"), true);
  assert.equal(validPaymentTransition("draft", "paid"), false);
  assert.equal(validPaymentTransition("cancelled", "pending"), false);
});

run("only managers can settle or reopen bill shares", () => {
  assert.equal(canUpdateBillParticipantStatus({ isManager: true, isSelf: false, currentStatus: "pending", nextStatus: "paid" }), true);
  assert.equal(canUpdateBillParticipantStatus({ isManager: true, isSelf: false, currentStatus: "paid", nextStatus: "pending" }), true);
  assert.equal(canUpdateBillParticipantStatus({ isManager: false, isSelf: true, currentStatus: "pending", nextStatus: "paid" }), false);
  assert.equal(canUpdateBillParticipantStatus({ isManager: false, isSelf: true, currentStatus: "paid", nextStatus: "pending" }), false);
});

run("participants may only decline their own pending bill share", () => {
  assert.equal(canUpdateBillParticipantStatus({ isManager: false, isSelf: true, currentStatus: "pending", nextStatus: "declined" }), true);
  assert.equal(canUpdateBillParticipantStatus({ isManager: false, isSelf: false, currentStatus: "pending", nextStatus: "declined" }), false);
  assert.equal(canUpdateBillParticipantStatus({ isManager: false, isSelf: true, currentStatus: "paid", nextStatus: "declined" }), false);
});