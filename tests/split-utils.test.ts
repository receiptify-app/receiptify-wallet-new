import assert from "node:assert/strict";
import { allocationSummary, billStatus, calculateSplitBalances, canSplit, canUpdateBillParticipantStatus, validPaymentTransition, validateAllocations } from "../server/split-utils";

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

run("canonical Screwfix and Party Food balances preserve personal remainder", () => {
  const members = [
    { id: "owner", userId: "owner-user", status: "active" },
    { id: "friend", userId: "friend-user", status: "active" },
  ];
  const result = calculateSplitBalances({
    members,
    receipts: [{ id: "screwfix", userId: "owner-user", total: "23.68", exchangeRateToGBP: "1" }],
    expenses: [{ id: "party-food", payerMemberId: "owner", amount: "120.00" }],
    assignments: [
      { receiptId: "screwfix", memberId: "friend", shareAmount: "6.69", status: "pending" },
      { receiptId: "party-food", sourceId: "party-food", sourceType: "expense", memberId: "friend", shareAmount: "50.00", status: "pending" },
    ],
    bills: [],
  });
  assert.deepEqual(
    {
      totalSpent: result.totalSpent,
      allocatedAmount: result.allocatedAmount,
      paidAmount: result.paidAmount,
      outstandingAmount: result.outstandingAmount,
      personalAmount: result.personalAmount,
      receiptCount: result.receiptCount,
    },
    {
      totalSpent: 143.68,
      allocatedAmount: 56.69,
      paidAmount: 0,
      outstandingAmount: 56.69,
      personalAmount: 86.99,
      receiptCount: 1,
    },
  );
  const owner = result.memberBalances.find((member) => member.memberId === "owner")!;
  assert.equal(owner.paidUpfrontAmount, 143.68);
  assert.equal(owner.personalAmount, 86.99);
  assert.equal(owner.outstandingToReceive, 56.69);
});

run("payer self-shares stay personal while another member's share is debt", () => {
  const result = calculateSplitBalances({
    members: [
      { id: "owner", userId: "owner-user", status: "active" },
      { id: "friend", userId: "friend-user", status: "active" },
    ],
    receipts: [{ id: "receipt", userId: "owner-user", total: "36.00" }],
    expenses: [],
    assignments: [
      { receiptId: "receipt", memberId: "owner", shareAmount: "18.00", status: "pending" },
      { receiptId: "receipt", memberId: "friend", shareAmount: "18.00", status: "paid" },
    ],
    bills: [],
  });
  assert.equal(result.totalSpent, 36);
  assert.equal(result.allocatedAmount, 18);
  assert.equal(result.paidAmount, 18);
  assert.equal(result.outstandingAmount, 0);
  assert.equal(result.personalAmount, 18);
});

run("Dinner £36 moves from partially settled to fully settled without changing allocation", () => {
  const members = [
    { id: "payer", userId: "payer-user", status: "active" },
    { id: "friend-a", userId: "friend-a-user", status: "active" },
    { id: "friend-b", userId: "friend-b-user", status: "active" },
  ];
  const calculate = (secondStatus: "pending" | "paid") =>
    calculateSplitBalances({
      members,
      receipts: [{ id: "dinner", userId: "payer-user", total: "36.00" }],
      expenses: [],
      assignments: [
        { receiptId: "dinner", memberId: "payer", shareAmount: "12.00", status: "pending" },
        { receiptId: "dinner", memberId: "friend-a", shareAmount: "12.00", status: "paid" },
        { receiptId: "dinner", memberId: "friend-b", shareAmount: "12.00", status: secondStatus },
      ],
      bills: [],
    });

  const partial = calculate("pending");
  assert.equal(partial.totalSpent, 36);
  assert.equal(partial.allocatedAmount, 24);
  assert.equal(partial.paidAmount, 12);
  assert.equal(partial.outstandingAmount, 12);
  assert.equal(partial.personalAmount, 12);
  assert.equal(partial.allocatedAmount, partial.paidAmount + partial.outstandingAmount);

  const settled = calculate("paid");
  assert.equal(settled.totalSpent, 36);
  assert.equal(settled.allocatedAmount, 24);
  assert.equal(settled.paidAmount, 24);
  assert.equal(settled.outstandingAmount, 0);
  assert.equal(settled.personalAmount, 12);
  assert.equal(settled.allocatedAmount, settled.paidAmount + settled.outstandingAmount);
});

run("a contributor-paid receipt attributes the owner's debt to the contributor", () => {
  const result = calculateSplitBalances({
    members: [
      { id: "owner", userId: "owner-user", status: "active" },
      { id: "contributor", userId: "contributor-user", status: "active" },
    ],
    receipts: [{ id: "receipt", userId: "contributor-user", total: "20.00" }],
    expenses: [],
    assignments: [
      { receiptId: "receipt", memberId: "owner", shareAmount: "8.00", status: "pending" },
      { receiptId: "receipt", memberId: "contributor", shareAmount: "12.00", status: "pending" },
    ],
    bills: [],
  });
  assert.equal(result.allocatedAmount, 8);
  assert.equal(result.personalAmount, 12);
  const contributor = result.memberBalances.find((member) => member.memberId === "contributor")!;
  assert.equal(contributor.paidUpfrontAmount, 20);
  assert.equal(contributor.outstandingToReceive, 8);
  assert.equal(contributor.personalAmount, 12);
});

run("manual expenses support explicit and unknown payers without inventing payer identity", () => {
  const result = calculateSplitBalances({
    members: [
      { id: "owner", userId: "owner-user", status: "active" },
      { id: "friend", userId: "friend-user", status: "invited" },
    ],
    receipts: [],
    expenses: [
      { id: "known", payerMemberId: "owner", amount: "12.00" },
      { id: "unknown", payerMemberId: null, amount: "8.00" },
    ],
    assignments: [
      { receiptId: "known", sourceId: "known", sourceType: "expense", memberId: "friend", shareAmount: "5.00", status: "pending" },
      { receiptId: "unknown", sourceId: "unknown", sourceType: "expense", memberId: "friend", shareAmount: "3.00", status: "pending" },
    ],
    bills: [],
  });
  assert.equal(result.totalSpent, 20);
  assert.equal(result.allocatedAmount, 8);
  assert.equal(result.personalAmount, 12);
  const owner = result.memberBalances.find((member) => member.memberId === "owner")!;
  assert.equal(owner.paidUpfrontAmount, 12);
  assert.equal(owner.outstandingToReceive, 5);
});

run("one-off creator and declined shares remain personal", () => {
  const result = calculateSplitBalances({
    members: [
      { id: "creator", userId: "creator-user", status: "active" },
      { id: "friend", userId: "friend-user", status: "active" },
      { id: "declined", userId: "declined-user", status: "active" },
    ],
    receipts: [],
    expenses: [],
    assignments: [],
    bills: [{
      id: "bill",
      createdBy: "creator-user",
      amount: "36.00",
      participants: [
        { memberId: "creator", shareAmount: "12.00", status: "pending" },
        { memberId: "friend", shareAmount: "12.00", status: "paid" },
        { memberId: "declined", shareAmount: "12.00", status: "declined" },
      ],
    }],
  });
  assert.equal(result.totalSpent, 36);
  assert.equal(result.allocatedAmount, 12);
  assert.equal(result.paidAmount, 12);
  assert.equal(result.outstandingAmount, 0);
  assert.equal(result.personalAmount, 24);
});

run("removed debtors cannot leave invisible bill debt in canonical totals", () => {
  const result = calculateSplitBalances({
    members: [
      { id: "owner", userId: "owner-user", status: "active" },
      { id: "removed", userId: "removed-user", status: "removed" },
    ],
    receipts: [],
    expenses: [],
    assignments: [],
    bills: [{
      id: "bill",
      createdBy: "owner-user",
      amount: "10.00",
      participants: [
        { memberId: "removed", shareAmount: "10.00", status: "paid" },
      ],
    }],
  });
  assert.equal(result.totalSpent, 10);
  assert.equal(result.allocatedAmount, 0);
  assert.equal(result.paidAmount, 0);
  assert.equal(result.outstandingAmount, 0);
  assert.equal(result.personalAmount, 10);
  assert.equal(result.memberBalances.some((member) => member.memberId === "removed"), false);
});

run("GBP conversion is rounded in pence and item shares never duplicate source spend", () => {
  const result = calculateSplitBalances({
    members: [
      { id: "owner", userId: "owner-user", status: "active" },
      { id: "friend", userId: "friend-user", status: "active" },
    ],
    receipts: [{ id: "foreign", userId: "owner-user", total: "10.01", exchangeRateToGBP: "0.875" }],
    expenses: [],
    assignments: [
      { receiptId: "foreign", memberId: "friend", shareAmount: "2.50", status: "pending" },
      { receiptId: "foreign", memberId: "friend", shareAmount: "2.50", status: "pending" },
    ],
    bills: [],
  });
  assert.equal(result.totalSpent, 8.76);
  assert.equal(result.allocatedAmount, 5);
  assert.equal(result.outstandingAmount, 5);
  assert.equal(result.personalAmount, 3.76);
  assert.equal(result.receiptCount, 1);
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