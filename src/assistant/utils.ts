export const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

export function parseAmount(raw?: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.,-]/g, '').replace(/,/g, '');
  if (!cleaned.length) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isSkipIntent(input: string) {
  const trimmed = input.trim().toLowerCase();
  return trimmed === 'skip' || trimmed === 'no' || trimmed === 'none' || trimmed === 'nah' || trimmed === 'n/a';
}

export function isExitIntent(input: string) {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return false;

  const singleWord = new Set(['exit', 'close', 'cancel', 'stop', 'bye', 'goodbye']);
  if (singleWord.has(normalized)) {
    return true;
  }

  const phrases = [
    'no thanks',
    'no thank you',
    'no help needed',
    'nothing else',
    'that is all',
    'that will be all',
    'all good',
    'im good',
    "i'm good",
    'all set',
  ];

  return phrases.some((phrase) => normalized.includes(phrase));
}
