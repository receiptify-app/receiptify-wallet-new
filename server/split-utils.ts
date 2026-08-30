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