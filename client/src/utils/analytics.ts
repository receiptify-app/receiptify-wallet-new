import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';

export type DateRange = 'month' | 'week' | 'custom';

export interface Receipt {
  id: string;
  merchantName: string;
  total: string | number;
  date: string | Date;
  category?: string | null;
  imageUrl?: string | null;
  location?: string | null;
}

export interface CategoryTotal {
  category: string;
  amount: number;
  percentage: number;
  count: number;
  color: string;
}

export interface AnalyticsData {
  total: number;
  categories: CategoryTotal[];
  receipts: Receipt[];
  dateRange: {
    start: Date;
    end: Date;
    label: string;
  };
}

export interface MonthOption {
  key: string;        // "YYYY-MM"
  label: string;      // "Oct 2025"
  start: Date;
  end: Date;
}

/**
 * Build a list of months that contain at least one receipt.
 * Returns options sorted descending (most recent first).
 */
export function getAvailableMonthRanges(receipts: Receipt[]): MonthOption[] {
  const map = new Map<string, MonthOption>();

  receipts.forEach(r => {
    const d = typeof r.date === 'string' ? parseISO(r.date) : new Date(r.date);
    if (Number.isNaN(d.getTime())) return;
    const start = startOfMonth(d);
    const end = endOfMonth(d);
    const key = format(start, 'yyyy-MM');
    if (!map.has(key)) {
      map.set(key, {
        key,
        label: format(start, 'MMM yyyy'),
        start,
        end
      });
    }
  });

  return Array.from(map.values())
    .sort((a, b) => b.start.getTime() - a.start.getTime());
}

/**
 * Given a YYYY-MM key produced above, return its bounds or null.
 */
export function getMonthBoundsFromKey(key: string): { start: Date; end: Date; label: string } | null {
  if (!key || !/^\d{4}-\d{2}$/.test(key)) return null;
  const [y, m] = key.split('-').map(Number);
  const date = new Date(y, m - 1, 1);
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  return { start, end, label: format(start, 'MMM yyyy') };
}

export function getDateRangeBounds(range: DateRange, customStart?: Date, customEnd?: Date): { start: Date; end: Date; label: string } {
  const now = new Date();
  
  switch (range) {
    case 'week':
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 }),
        label: 'This Week'
      };
    case 'month':
      return {
        start: startOfMonth(now),
        end: endOfMonth(now),
        label: 'This Month'
      };
    case 'custom':
      if (!customStart || !customEnd) {
        return getDateRangeBounds('month');
      }
      return {
        start: customStart,
        end: customEnd,
        label: `${format(customStart, 'MMM d')} - ${format(customEnd, 'MMM d, yyyy')}`
      };
    default:
      return getDateRangeBounds('month');
  }
}

export function filterReceiptsByDateRange(receipts: Receipt[], start: Date, end: Date): Receipt[] {
  return receipts.filter(receipt => {
    const receiptDate = new Date(receipt.date);
    return isWithinInterval(receiptDate, { start, end });
  });
}

export function calculateCategoryTotals(receipts: Receipt[], categoryColors: Map<string, string>): CategoryTotal[] {
  const categoryMap = new Map<string, { amount: number; count: number }>();
  let total = 0;

  receipts.forEach(receipt => {
    const amount = typeof receipt.total === 'string' ? parseFloat(receipt.total) : receipt.total;
    total += amount;

    const category = receipt.category || 'Other';
    const existing = categoryMap.get(category) || { amount: 0, count: 0 };
    categoryMap.set(category, {
      amount: existing.amount + amount,
      count: existing.count + 1
    });
  });

  const categories: CategoryTotal[] = Array.from(categoryMap.entries()).map(([category, data]) => ({
    category,
    amount: data.amount,
    percentage: total > 0 ? (data.amount / total) * 100 : 0,
    count: data.count,
    color: categoryColors.get(category.toLowerCase()) || '#757575'
  }));

  return categories.sort((a, b) => b.amount - a.amount);
}

export function getTopMerchants(receipts: Receipt[], limit: number = 5): Array<{ merchant: string; amount: number; count: number }> {
  const merchantMap = new Map<string, { amount: number; count: number }>();

  receipts.forEach(receipt => {
    const amount = typeof receipt.total === 'string' ? parseFloat(receipt.total) : receipt.total;
    const merchant = receipt.merchantName;
    
    const existing = merchantMap.get(merchant) || { amount: 0, count: 0 };
    merchantMap.set(merchant, {
      amount: existing.amount + amount,
      count: existing.count + 1
    });
  });

  return Array.from(merchantMap.entries())
    .map(([merchant, data]) => ({
      merchant,
      amount: data.amount,
      count: data.count
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

export function computeAnalytics(
  receipts: Receipt[],
  dateRange: DateRange,
  categoryColors: Map<string, string>,
  customStart?: Date,
  customEnd?: Date
): AnalyticsData {
  const { start, end, label } = getDateRangeBounds(dateRange, customStart, customEnd);
  const filteredReceipts = filterReceiptsByDateRange(receipts, start, end);
  const categories = calculateCategoryTotals(filteredReceipts, categoryColors);
  const total = categories.reduce((sum, cat) => sum + cat.amount, 0);

  return {
    total,
    categories,
    receipts: filteredReceipts,
    dateRange: { start, end, label }
  };
}
