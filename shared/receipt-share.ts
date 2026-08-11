// Helpers for a user's personal share of a receipt.
// A receipt may be shared (e.g. split with friends); the user can record what
// portion is theirs, either as a fixed amount or a percentage of the total.

export interface ReceiptShareFields {
  total: string | number;
  myShareType?: string | null; // 'amount' | 'percent'
  myShareValue?: string | number | null;
}

/**
 * The user's effective spend for a receipt, in the receipt's currency.
 * Falls back to the full total when no share is set or the share is invalid.
 */
export function effectiveReceiptTotal(receipt: ReceiptShareFields): number {
  const total = typeof receipt.total === "string" ? parseFloat(receipt.total) : receipt.total;
  const safeTotal = Number.isFinite(total) ? total : 0;
  const value =
    receipt.myShareValue == null
      ? null
      : typeof receipt.myShareValue === "string"
        ? parseFloat(receipt.myShareValue)
        : receipt.myShareValue;
  if (value == null || !Number.isFinite(value) || value < 0) return safeTotal;
  if (receipt.myShareType === "amount") return Math.min(value, safeTotal);
  if (receipt.myShareType === "percent") return (safeTotal * Math.min(value, 100)) / 100;
  return safeTotal;
}
