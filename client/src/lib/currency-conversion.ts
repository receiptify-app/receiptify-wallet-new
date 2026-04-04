const BULK_CACHE: Record<string, { rates: Record<string, number>; fetchedAt: number }> = {};
const CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Fetch all exchange rates FROM a base currency via our server proxy.
 * Returns a map of currency code -> units of that currency per 1 base unit.
 * e.g. getRatesFromBase("GBP") → { JPY: 192.5, USD: 1.26, EUR: 1.17, GBP: 1 }
 *
 * To convert X JPY → GBP:  X / rates.JPY
 */
export async function getRatesFromBase(base: string): Promise<Record<string, number>> {
  const key = base.toUpperCase();
  const now = Date.now();
  if (BULK_CACHE[key] && now - BULK_CACHE[key].fetchedAt < CACHE_TTL_MS) {
    return BULK_CACHE[key].rates;
  }
  const res = await fetch(`/api/exchange-rates?base=${key}`);
  if (!res.ok) throw new Error(`Exchange rate fetch failed: ${res.status}`);
  const rates: Record<string, number> = await res.json();
  BULK_CACHE[key] = { rates, fetchedAt: now };
  return rates;
}

/** Fetch a single exchange rate: how many `to` units per 1 `from` unit */
export async function getExchangeRate(from: string, to: string): Promise<number> {
  if (!from || !to || from === to) return 1;
  const rates = await getRatesFromBase(from.toUpperCase());
  const rate = rates[to.toUpperCase()];
  if (!rate) throw new Error(`No rate found for ${from} -> ${to}`);
  return rate;
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
