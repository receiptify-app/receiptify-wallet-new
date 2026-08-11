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

/**
 * The owner's suggested share of a split receipt, in the receipt's currency:
 * total minus what's assigned to other folder members.
 *
 * Split assignment amounts are stored in GBP (the folder currency), so the
 * receipt total is converted to GBP via its snapshotted rate before
 * subtracting, and the remainder is converted back to the receipt currency.
 *
 * Returns null when there are no assignments to derive from.
 */
export function suggestedOwnerShare(
  receipt: { total: string | number; exchangeRateToGBP?: string | number | null },
  assignments: Array<{ shareAmount: string | number; isOwner: boolean }>,
): number | null {
  if (!assignments.length) return null;
  const total = typeof receipt.total === "string" ? parseFloat(receipt.total) : receipt.total;
  if (!Number.isFinite(total)) return null;
  let rate =
    receipt.exchangeRateToGBP == null
      ? 1
      : typeof receipt.exchangeRateToGBP === "string"
        ? parseFloat(receipt.exchangeRateToGBP)
        : receipt.exchangeRateToGBP;
  if (!Number.isFinite(rate) || rate <= 0) rate = 1;

  const othersGBP = assignments.reduce((sum, a) => {
    if (a.isOwner) return sum; // the owner's own assignment isn't owed to anyone else
    const v = typeof a.shareAmount === "string" ? parseFloat(a.shareAmount) : a.shareAmount;
    return sum + (Number.isFinite(v) ? v : 0);
  }, 0);

  const totalGBP = total * rate;
  const suggested = (totalGBP - othersGBP) / rate; // back to receipt currency
  const clamped = Math.min(Math.max(suggested, 0), total);
  return Math.round(clamped * 100) / 100;
}
