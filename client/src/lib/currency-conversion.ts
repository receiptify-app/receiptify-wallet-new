const RATE_CACHE: Record<string, { rate: number; fetchedAt: number }> = {};
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

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
