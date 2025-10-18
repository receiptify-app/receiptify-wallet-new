import { useState, useEffect } from 'react';
import { getSelectedCurrency, setSelectedCurrency as saveCurrency, getCurrencySymbol, formatCurrency } from '@/lib/currency';

export function useCurrency() {
  const [currency, setCurrency] = useState<string>(getSelectedCurrency());

  useEffect(() => {
    const handleStorageChange = () => {
      setCurrency(getSelectedCurrency());
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const updateCurrency = (code: string) => {
    saveCurrency(code);
    setCurrency(code);
    // Trigger a custom event to notify other components
    window.dispatchEvent(new Event('currencyChange'));
  };

  const symbol = getCurrencySymbol(currency);

  const format = (amount: number | string) => formatCurrency(amount, currency);

  return {
    currency,
    symbol,
    updateCurrency,
    format,
  };
}
