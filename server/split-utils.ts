/** Pure authorization and money helpers for Split routes and tests. */
export type SplitRole = "owner" | "viewer" | "contributor" | "editor" | "member";
export type SplitPermission = "read" | "add" | "edit" | "manage";

const rank: Record<SplitRole, number> = {
  viewer: 0,
  member: 0, // compatibility with folders created before roles existed
  contributor: 1,
  editor: 2,
  owner: 3,
};

export function normalizeSplitRole(role: string | null | undefined): SplitRole {
  return role === "owner" || role === "contributor" || role === "editor" || role === "viewer"
    ? role
    : "viewer";
}

export function canSplit(role: string | null | undefined, permission: SplitPermission): boolean {
  const required: Record<SplitPermission, number> = { read: 0, add: 1, edit: 2, manage: 3 };
  return rank[normalizeSplitRole(role)] >= required[permission];
}

export function money(value: string | number | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value ?? "0");
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

function cents(value: string | number | null | undefined): number {
  return Math.round(money(value) * 100);
}

function fromCents(value: number): number {
  return Math.round(value) / 100;
}

export function allocationSummary(
  sourceAmount: string | number,
  allocations: Array<{ shareAmount: string | number }>,
) {
  const total = money(sourceAmount);
  const allocated = money(allocations.reduce((sum, row) => sum + money(row.shareAmount), 0));
  return { total, allocated, personal: money(total - allocated), isOverAllocated: allocated > total + 0.005 };
}

export function validateAllocations(
  sourceAmount: string | number,
  allocations: Array<{ shareAmount: string | number }>,
): string | null {
  if (allocations.some((row) => money(row.shareAmount) < 0)) return "Assignment amounts cannot be negative";
  const summary = allocationSummary(sourceAmount, allocations);
  return summary.isOverAllocated
    ? `Assignments (£${summary.allocated.toFixed(2)}) exceed available amount (£${summary.total.toFixed(2)})`
    : null;
}

type BalanceMember = {
  id: string;
  userId: string | null;
  status?: string | null;
};

type BalanceReceipt = {
  id: string;
  userId: string;
  total: string | number;
  exchangeRateToGBP?: string | number | null;
};

type BalanceExpense = {
  id: string;
  payerMemberId?: string | null;
  amount: string | number;
};

type BalanceAssignment = {
  receiptId: string;
  sourceType?: string | null;
  sourceId?: string | null;
  memberId: string;
  shareAmount: string | number;
  status?: string | null;
};

type BalanceBill = {
  id: string;
  createdBy: string;
  amount: string | number;
  participants: Array<{
    memberId: string;
    shareAmount: string | number;
    status?: string | null;
  }>;
};

export type SplitMemberBalance = {
  memberId: string;
  allocatedAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  paidUpfrontAmount: number;
  personalAmount: number;
  recoverableAmount: number;
  recoveredAmount: number;
  outstandingToReceive: number;
};

export type SplitBalanceSummary = {
  totalSpent: number;
  allocatedAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  personalAmount: number;
  receiptCount: number;
  memberBalances: SplitMemberBalance[];
};

/**
 * Canonical Split ledger summary. Source facts are counted once; assignments
 * only decide which part is another member's debt. A payer's own assignment is
 * personal, while an allocation with an unknown payer remains shared but is
 * not attributed as money due to a particular recipient.
 */
export function calculateSplitBalances({
  members,
  receipts,
  expenses,
  assignments,
  bills,
}: {
  members: BalanceMember[];
  receipts: BalanceReceipt[];
  expenses: BalanceExpense[];
  assignments: BalanceAssignment[];
  bills: BalanceBill[];
}): SplitBalanceSummary {
  type Source = {
    amountCents: number;
    payerMemberId: string | null;
  };
  type Debt = {
    sourceKey: string;
    memberId: string;
    amountCents: number;
    status: "pending" | "paid";
  };

  const memberForUser = (userId: string) =>
    members.find((member) => member.userId === userId)?.id ?? null;
  const allocatableMemberIds = new Set(
    members.filter((member) => member.status !== "removed").map((member) => member.id),
  );
  const sources = new Map<string, Source>();

  for (const receipt of receipts) {
    const rawRate = receipt.exchangeRateToGBP == null ? 1 : Number(receipt.exchangeRateToGBP);
    const rate = Number.isFinite(rawRate) && rawRate > 0 ? rawRate : 1;
    sources.set(`receipt:${receipt.id}`, {
      amountCents: Math.round(money(receipt.total) * rate * 100),
      payerMemberId: memberForUser(receipt.userId),
    });
  }
  for (const expense of expenses) {
    sources.set(`expense:${expense.id}`, {
      amountCents: cents(expense.amount),
      payerMemberId:
        expense.payerMemberId &&
        members.some((member) => member.id === expense.payerMemberId)
          ? expense.payerMemberId
          : null,
    });
  }
  for (const bill of bills) {
    sources.set(`bill:${bill.id}`, {
      amountCents: cents(bill.amount),
      payerMemberId: memberForUser(bill.createdBy),
    });
  }

  const debts: Debt[] = [];
  for (const assignment of assignments) {
    if (assignment.status !== "paid" && assignment.status !== "pending") continue;
    const sourceKey =
      assignment.sourceType === "expense"
        ? `expense:${assignment.sourceId || assignment.receiptId}`
        : `receipt:${assignment.receiptId}`;
    const source = sources.get(sourceKey);
    const amountCents = cents(assignment.shareAmount);
    if (
      !source ||
      amountCents <= 0 ||
      !allocatableMemberIds.has(assignment.memberId) ||
      source.payerMemberId === assignment.memberId
    ) continue;
    debts.push({
      sourceKey,
      memberId: assignment.memberId,
      amountCents,
      status: assignment.status,
    });
  }
  for (const bill of bills) {
    const sourceKey = `bill:${bill.id}`;
    const source = sources.get(sourceKey);
    if (!source) continue;
    for (const participant of bill.participants) {
      if (participant.status !== "paid" && participant.status !== "pending") continue;
      const amountCents = cents(participant.shareAmount);
      if (
        amountCents <= 0 ||
        !allocatableMemberIds.has(participant.memberId) ||
        source.payerMemberId === participant.memberId
      ) continue;
      debts.push({
        sourceKey,
        memberId: participant.memberId,
        amountCents,
        status: participant.status,
      });
    }
  }

  const totalSpentCents = Array.from(sources.values()).reduce(
    (sum, source) => sum + source.amountCents,
    0,
  );
  const allocatedCents = debts.reduce((sum, debt) => sum + debt.amountCents, 0);
  const paidCents = debts
    .filter((debt) => debt.status === "paid")
    .reduce((sum, debt) => sum + debt.amountCents, 0);
  const outstandingCents = debts
    .filter((debt) => debt.status === "pending")
    .reduce((sum, debt) => sum + debt.amountCents, 0);

  const memberBalances = members
    .filter((member) => member.status !== "removed")
    .map((member): SplitMemberBalance => {
      const assignedDebts = debts.filter((debt) => debt.memberId === member.id);
      const paidSources = Array.from(sources.entries()).filter(
        ([, source]) => source.payerMemberId === member.id,
      );
      const sourceDebt = (sourceKey: string, status?: "pending" | "paid") =>
        debts
          .filter((debt) => debt.sourceKey === sourceKey && (!status || debt.status === status))
          .reduce((sum, debt) => sum + debt.amountCents, 0);
      const paidUpfrontCents = paidSources.reduce((sum, [, source]) => sum + source.amountCents, 0);
      const recoverableCents = paidSources.reduce(
        (sum, [sourceKey]) => sum + sourceDebt(sourceKey),
        0,
      );
      const recoveredCents = paidSources.reduce(
        (sum, [sourceKey]) => sum + sourceDebt(sourceKey, "paid"),
        0,
      );
      const outstandingToReceiveCents = paidSources.reduce(
        (sum, [sourceKey]) => sum + sourceDebt(sourceKey, "pending"),
        0,
      );
      const memberAllocatedCents = assignedDebts.reduce(
        (sum, debt) => sum + debt.amountCents,
        0,
      );
      const memberPaidCents = assignedDebts
        .filter((debt) => debt.status === "paid")
        .reduce((sum, debt) => sum + debt.amountCents, 0);
      const memberOutstandingCents = assignedDebts
        .filter((debt) => debt.status === "pending")
        .reduce((sum, debt) => sum + debt.amountCents, 0);
      return {
        memberId: member.id,
        allocatedAmount: fromCents(memberAllocatedCents),
        paidAmount: fromCents(memberPaidCents),
        outstandingAmount: fromCents(memberOutstandingCents),
        paidUpfrontAmount: fromCents(paidUpfrontCents),
        personalAmount: fromCents(Math.max(0, paidUpfrontCents - recoverableCents)),
        recoverableAmount: fromCents(recoverableCents),
        recoveredAmount: fromCents(recoveredCents),
        outstandingToReceive: fromCents(outstandingToReceiveCents),
      };
    });

  return {
    totalSpent: fromCents(totalSpentCents),
    allocatedAmount: fromCents(allocatedCents),
    paidAmount: fromCents(paidCents),
    outstandingAmount: fromCents(outstandingCents),
    personalAmount: fromCents(Math.max(0, totalSpentCents - allocatedCents)),
    receiptCount: receipts.length,
    memberBalances,
  };
}

export function billStatus(participants: Array<{ status: string | null }>): "unpaid" | "partially_paid" | "settled" {
  if (participants.length > 0 && participants.every((p) => p.status === "paid")) return "settled";
  if (participants.some((p) => p.status === "paid")) return "partially_paid";
  return "unpaid";
}

export function validPaymentTransition(
  from: string,
  to: string,
): boolean {
  const allowed: Record<string, string[]> = {
    draft: ["pending", "cancelled"],
    pending: ["processing", "paid", "failed", "cancelled", "declined"],
    processing: ["paid", "failed", "cancelled"],
    failed: ["pending", "cancelled"],
    paid: ["refunded"],
    cancelled: [],
    declined: [],
    refunded: [],
  };
  return (allowed[from] || []).includes(to);
}

export function canUpdateBillParticipantStatus({
  isManager,
  isSelf,
  currentStatus,
  nextStatus,
}: {
  isManager: boolean;
  isSelf: boolean;
  currentStatus: string | null;
  nextStatus: string;
}): boolean {
  if (isManager) return ["pending", "paid", "declined"].includes(nextStatus);
  return isSelf && currentStatus === "pending" && nextStatus === "declined";
}