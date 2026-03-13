const RATE_CACHE: Record<string, { rate: number; fetchedAt: number }> = {};
const BULK_CACHE: Record<string, { rates: Record<string, number>; fetchedAt: number }> = {};
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Fetch a single exchange rate: how many `to` units per 1 `from` unit */
export async function getExchangeRate(from: string, to: string): Promise<number> {
  if (!from || !to || from === to) return 1;
  const key = `${from}_${to}`;
  const now = Date.now();
  if (RATE_CACHE[key] && now - RATE_CACHE[key].fetchedAt < CACHE_TTL_MS) {
    return RATE_CACHE[key].rate;
  }
  const res = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`);
  if (!res.ok) throw new Error(`Exchange rate fetch failed: ${res.status}`);
  const data = await res.json();
  const rate: number = data.rates[to];
  if (!rate) throw new Error(`No rate found for ${from} -> ${to}`);
  RATE_CACHE[key] = { rate, fetchedAt: now };
  return rate;
}

/**
 * Fetch all exchange rates FROM a base currency in a single call.
 * Returns a map of currency code -> units of that currency per 1 base unit.
 * e.g. getRatesFromBase("GBP") → { JPY: 192.5, USD: 1.26, EUR: 1.17, ... }
 *
 * To convert X JPY → GBP:  X / rates.JPY
 */
export async function getRatesFromBase(base: string): Promise<Record<string, number>> {
  const now = Date.now();
  if (BULK_CACHE[base] && now - BULK_CACHE[base].fetchedAt < CACHE_TTL_MS) {
    return BULK_CACHE[base].rates;
  }
  const res = await fetch(`https://api.frankfurter.app/latest?from=${base}`);
  if (!res.ok) throw new Error(`Bulk exchange rate fetch failed: ${res.status}`);
  const data = await res.json();
  const rates: Record<string, number> = { ...data.rates, [base]: 1 };
  BULK_CACHE[base] = { rates, fetchedAt: now };
  return rates;
}

/** Format an amount in its native currency using the browser's Intl API */
export function formatWithCurrencyCode(amount: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toFixed(2)}`;
  }
}
