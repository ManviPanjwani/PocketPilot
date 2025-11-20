export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY'] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export function normalizeCurrencyCode(code?: string | null): SupportedCurrency | 'USD' {
  if (!code) {
    return 'USD';
  }
  const normalized = code.trim().toUpperCase();
  return (SUPPORTED_CURRENCIES.find((option) => option === normalized) ?? 'USD');
}
