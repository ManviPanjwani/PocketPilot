export const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const CATEGORY_LABELS = [
  'Groceries',
  'Dining Out',
  'Rent',
  'Utilities',
  'Transportation',
  'Entertainment',
  'Shopping',
  'Health',
  'Travel',
  'Other',
];

export const STANDARD_CATEGORIES = CATEGORY_LABELS;

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

export function parseISODateInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Direct ISO YYYY-MM-DD
  const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
  if (isoPattern.test(trimmed)) {
    const date = new Date(trimmed + 'T00:00:00Z');
    if (!Number.isNaN(date.getTime())) {
      return trimmed;
    }
  }

  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) {
    const date = new Date(parsed);
    return date.toISOString().slice(0, 10);
  }

  return null;
}

export function normalizeCategoryInput(input?: string | null): string | undefined {
  if (!input) return undefined;
  const trimmed = input.trim();
  if (!trimmed.length) return undefined;

  const lowered = trimmed.toLowerCase();
  const knownMatch = CATEGORY_LABELS.find((label) => label.toLowerCase() === lowered);
  if (knownMatch) {
    return knownMatch;
  }

  return trimmed
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function isYesIntent(input: string) {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return false;
  return ['yes', 'y', 'sure', 'yeah', 'yep', 'ok', 'okay', 'affirmative'].includes(normalized);
}

export function isNoIntent(input: string) {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return false;
  return ['no', 'n', 'nope', 'nah'].includes(normalized);
}

export function isDoneIntent(input: string) {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return false;
  return [
    'done',
    'finished',
    'all done',
    'no more',
    'complete',
    'none',
    'that is all',
    "that's all",
    'thats all',
  ].includes(normalized);
}
