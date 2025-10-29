import { addExpense, fetchRecentExpenses, updateExpense, deleteExpense } from '@/services/expenses';
import { addGoal } from '@/services/goals';
import { upsertUserProfile } from '@/services/profile';

import {
  STANDARD_CATEGORIES,
  currencyFormatter,
  isSkipIntent,
  normalizeCategoryInput,
  parseAmount,
  parseISODateInput,
} from './utils';

import type { Expense } from '@/services/expenses';

export type FlowId = 'expense' | 'income' | 'goal' | 'deleteExpense' | 'updateExpense';

const EXPENSE_AMOUNT_SUGGESTIONS = ['20', '45', '75'];
const EXPENSE_CATEGORY_SUGGESTIONS = STANDARD_CATEGORIES.slice(0, 5);
const GOAL_NAME_SUGGESTIONS = ['Emergency fund', 'Vacation', 'New laptop'];
const GOAL_AMOUNT_SUGGESTIONS = ['500', '1000', '2500'];
const INCOME_SUGGESTIONS = ['4500', '5000', '6000'];

type ExpenseState = {
  id: 'expense';
  step: 'awaitAmount' | 'awaitCategory' | 'awaitNote';
  data: {
    amount?: number;
    category?: string;
    note?: string;
  };
};

type IncomeState = {
  id: 'income';
  step: 'awaitAmount';
  data: {};
};

type GoalState = {
  id: 'goal';
  step: 'awaitTitle' | 'awaitAmount';
  data: {
    title?: string;
    amount?: number;
  };
};

type DeleteExpenseState = {
  id: 'deleteExpense';
  step: 'awaitDate' | 'awaitSelection';
  data: {
    dateInput?: string;
    matches: ExpenseWithMeta[];
    category?: string;
  };
};

type UpdateExpenseState = {
  id: 'updateExpense';
  step: 'awaitDate' | 'awaitSelection' | 'awaitNewAmount';
  data: {
    dateInput?: string;
    matches: ExpenseWithMeta[];
    category?: string;
    selected?: ExpenseWithMeta;
  };
};

export type FlowState = ExpenseState | IncomeState | GoalState | DeleteExpenseState | UpdateExpenseState;

export type FlowInit = {
  state: FlowState;
  intro: string;
};

type FlowAdvanceResult = {
  messages: string[];
  nextState: FlowState | null;
};

type ExpenseWithMeta = Expense & {
  displayDate: string;
  displayAmount: string;
  rawDate: string;
  summary: string;
};

type ExpenseLookupFilters = {
  dateISO?: string;
  category?: string;
};

function toExpenseMeta(expense: Expense): ExpenseWithMeta | null {
  const createdAtISO = expense.createdAtISO
    ?? (expense.createdAt && typeof expense.createdAt.toDate === 'function'
      ? expense.createdAt.toDate().toISOString()
      : null);
  if (!createdAtISO) return null;

  const rawDate = createdAtISO.slice(0, 10);
  const displayAmount = currencyFormatter.format(expense.amount);
  let displayDate = rawDate;
  try {
    displayDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(createdAtISO));
  } catch {
    // ignore parsing error
  }

  const category = expense.category ?? 'Uncategorized';
  const note = expense.note ? ` · ${expense.note}` : '';

  return {
    ...expense,
    displayAmount,
    displayDate,
    rawDate,
    summary: `${displayAmount} (${category}${note})`,
  };
}

function parseExpenseLookupFilters(raw: string): ExpenseLookupFilters {
  const trimmed = raw.trim();
  if (!trimmed.length) return {};

  const result: ExpenseLookupFilters = {};

  const inlineDateMatch = trimmed.match(/\d{4}-\d{2}-\d{2}/);
  if (inlineDateMatch) {
    const iso = parseISODateInput(inlineDateMatch[0]);
    if (iso) {
      result.dateISO = iso;
    }
  }

  const candidates = trimmed
    .split(/[,;]| and /gi)
    .map((segment) => segment.trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    if (!result.dateISO) {
      const iso = parseISODateInput(candidate);
      if (iso) {
        result.dateISO = iso;
        continue;
      }
    }

    if (!result.category) {
      const normalized = normalizeCategoryInput(candidate);
      if (normalized) {
        result.category = normalized;
      }
    }
  }

  if (!result.dateISO) {
    const iso = parseISODateInput(trimmed);
    if (iso) {
      result.dateISO = iso;
    }
  }

  const remainder = result.dateISO ? trimmed.replace(result.dateISO, '').trim() : trimmed;
  if (!result.category && remainder && !/\d/.test(remainder)) {
    const normalized = normalizeCategoryInput(remainder);
    if (normalized) {
      result.category = normalized;
    }
  }

  return result;
}

async function lookupExpenses(filters: ExpenseLookupFilters) {
  const recentMeta = (await fetchRecentExpenses(120))
    .map(toExpenseMeta)
    .filter((item): item is ExpenseWithMeta => Boolean(item));

  let filtered = recentMeta;
  if (filters.dateISO) {
    filtered = filtered.filter((expense) => expense.rawDate === filters.dateISO);
  }
  if (filters.category) {
    const normalized = filters.category.toLowerCase();
    filtered = filtered.filter((expense) => (expense.category ?? '').toLowerCase() === normalized);
  }

  return {
    matches: filtered,
    recent: recentMeta.slice(0, 15),
    filters,
  } as const;
}

export function initFlow(flowId: FlowId): FlowInit {
  switch (flowId) {
    case 'expense':
      return {
        state: { id: 'expense', step: 'awaitAmount', data: {} },
        intro: 'Let’s log an expense. How much did you spend?',
      };
    case 'income':
      return {
        state: { id: 'income', step: 'awaitAmount', data: {} },
        intro: 'Sure! What is your monthly income right now?',
      };
    case 'goal':
      return {
        state: { id: 'goal', step: 'awaitTitle', data: {} },
        intro: 'Happy to help with a goal. What would you like to call this goal?',
      };
    case 'deleteExpense':
      return {
        state: { id: 'deleteExpense', step: 'awaitDate', data: { matches: [] } },
        intro: 'Let’s remove an expense. Give me a date (e.g. 2024-06-12) or just say the category like “Groceries”.',
      };
    case 'updateExpense':
      return {
        state: { id: 'updateExpense', step: 'awaitDate', data: { matches: [] } },
        intro: 'Sure, we can edit an expense. Provide a date or category so I can find it.',
      };
    default:
      throw new Error('Unknown assistant flow');
  }
}

export async function handleFlowInput(state: FlowState, input: string): Promise<FlowAdvanceResult> {
  switch (state.id) {
    case 'expense':
      return handleExpenseFlow(state, input);
    case 'income':
      return handleIncomeFlow(state, input);
    case 'goal':
      return handleGoalFlow(state, input);
    case 'deleteExpense':
      return handleDeleteExpenseFlow(state, input);
    case 'updateExpense':
      return handleUpdateExpenseFlow(state, input);
    default:
      throw new Error('Unsupported flow');
  }
}

async function handleExpenseFlow(state: ExpenseState, input: string): Promise<FlowAdvanceResult> {
  const trimmed = input.trim();

  if (state.step === 'awaitAmount') {
    const amount = parseAmount(trimmed);
    if (!amount || amount <= 0) {
      return {
        messages: ['I need a positive amount. For example, “25.60”.'],
        nextState: state,
      };
    }
    const nextState: ExpenseState = {
      id: 'expense',
      step: 'awaitCategory',
      data: { amount },
    };
    return {
      messages: [
        `Got it — ${currencyFormatter.format(amount)}.`,
        'Which category should I file this under? Say “skip” to leave it uncategorized.',
      ],
      nextState,
    };
  }

  if (state.step === 'awaitCategory') {
    const category = isSkipIntent(trimmed) ? undefined : normalizeCategoryInput(trimmed);
    const nextState: ExpenseState = {
      id: 'expense',
      step: 'awaitNote',
      data: { ...state.data, category },
    };
    return {
      messages: ['Any note you’d like to add? You can also say “skip”.'],
      nextState,
    };
  }

  if (state.step === 'awaitNote') {
    const note = isSkipIntent(trimmed) ? undefined : trimmed;
    const amount = state.data.amount ?? 0;
    const payload = {
      amount,
      totalAmount: amount,
      category: state.data.category,
      note,
    };
    await addExpense(payload);
    return {
      messages: [
        'All set! I logged that expense for you.',
        'Need anything else?',
      ],
      nextState: null,
    };
  }

  return { messages: ['Let’s start over.'], nextState: null };
}

async function handleIncomeFlow(state: IncomeState, input: string): Promise<FlowAdvanceResult> {
  const amount = parseAmount(input);
  if (!amount || amount <= 0) {
    return {
      messages: ['Enter a positive amount, e.g. “5400”.'],
      nextState: state,
    };
  }

  await upsertUserProfile({ monthlyIncome: amount, currency: 'USD' });
  return {
    messages: [
      `Done! Monthly income updated to ${currencyFormatter.format(amount)}.`,
      'Anything else I can do?',
    ],
    nextState: null,
  };
}

async function handleGoalFlow(state: GoalState, input: string): Promise<FlowAdvanceResult> {
  const trimmed = input.trim();

  if (state.step === 'awaitTitle') {
    if (!trimmed.length) {
      return {
        messages: ['Give the goal a name to help track it.'],
        nextState: state,
      };
    }
    const nextState: GoalState = {
      id: 'goal',
      step: 'awaitAmount',
      data: { title: trimmed },
    };
    return {
      messages: ['Great! What amount are you aiming for?'],
      nextState,
    };
  }

  if (state.step === 'awaitAmount') {
    const target = parseAmount(trimmed);
    if (!target || target <= 0) {
      return {
        messages: ['Enter the savings target as a positive number.'],
        nextState: state,
      };
    }
    const title = state.data.title ?? 'New goal';
    await addGoal({ title, targetAmount: target });
    return {
      messages: [
        `Goal “${title}” set for ${currencyFormatter.format(target)}.`,
        'Happy to help with another goal or expense!',
      ],
      nextState: null,
    };
  }

  return { messages: ['Let’s start that goal over.'], nextState: null };
}

async function handleDeleteExpenseFlow(state: DeleteExpenseState, input: string): Promise<FlowAdvanceResult> {
  if (state.step === 'awaitDate') {
    const filters = parseExpenseLookupFilters(input);
    const { matches, recent, filters: resolved } = await lookupExpenses(filters);
    const entries = matches.length ? matches : recent;

    if (!entries.length) {
      return {
        messages: ['I could not find any expenses yet. Try logging one first.'],
        nextState: null,
      };
    }

    const lines = entries.map((expense, index) => `${index + 1}. ${expense.summary} • ${expense.displayDate}`);
    const qualifiers: string[] = [];
    if (resolved.dateISO && matches.length) {
      qualifiers.push(`on ${entries[0].displayDate}`);
    }
    if (resolved.category) {
      qualifiers.push(`in ${resolved.category}`);
    }
    const header = matches.length
      ? `Found ${matches.length} expense(s)${qualifiers.length ? ' ' + qualifiers.join(' ') : ''}:`
      : `No expenses${qualifiers.length ? ' ' + qualifiers.join(' ') : ''}. Here are your latest ones:`;

    return {
      messages: [
        `${header}\n${lines.join('\n')}`,
        'Reply with the number to delete or say “cancel”.',
      ],
      nextState: {
        id: 'deleteExpense',
        step: 'awaitSelection',
        data: {
          matches: entries,
          dateInput: resolved.dateISO ?? input,
          category: resolved.category,
        },
      },
    };
  }

  if (state.step === 'awaitSelection') {
    const index = parseInt(input.trim(), 10) - 1;
    const match = state.data.matches[index];
    if (!match?.id) {
      return {
        messages: ['Please respond with one of the numbers from the list.'],
        nextState: state,
      };
    }

    await deleteExpense(match.id);
    return {
      messages: [`Deleted ${match.displayAmount} (${match.category ?? 'Uncategorized'}).`],
      nextState: null,
    };
  }

  return { messages: ['Let’s start over.'], nextState: null };
}

async function handleUpdateExpenseFlow(state: UpdateExpenseState, input: string): Promise<FlowAdvanceResult> {
  if (state.step === 'awaitDate') {
    const filters = parseExpenseLookupFilters(input);
    const { matches, recent, filters: resolved } = await lookupExpenses(filters);
    const entries = matches.length ? matches : recent;

    if (!entries.length) {
      return {
        messages: ['I could not find any expenses yet. Try logging one first.'],
        nextState: null,
      };
    }

    const lines = entries.map((expense, index) => `${index + 1}. ${expense.summary} • ${expense.displayDate}`);
    const qualifiers: string[] = [];
    if (resolved.dateISO && matches.length) {
      qualifiers.push(`on ${entries[0].displayDate}`);
    }
    if (resolved.category) {
      qualifiers.push(`in ${resolved.category}`);
    }
    const header = matches.length
      ? `Found ${matches.length} expense(s)${qualifiers.length ? ' ' + qualifiers.join(' ') : ''}:`
      : `No expenses${qualifiers.length ? ' ' + qualifiers.join(' ') : ''}. Here are your latest ones:`;

    return {
      messages: [
        `${header}\n${lines.join('\n')}`,
        'Reply with the number you want to update or say “cancel”.',
      ],
      nextState: {
        id: 'updateExpense',
        step: 'awaitSelection',
        data: {
          matches: entries,
          dateInput: resolved.dateISO ?? input,
          category: resolved.category,
        },
      },
    };
  }

  if (state.step === 'awaitSelection') {
    const index = parseInt(input.trim(), 10) - 1;
    const match = state.data.matches[index];
    if (!match?.id) {
      return {
        messages: ['Please respond with one of the numbers from the list.'],
        nextState: state,
      };
    }

    return {
      messages: [
        `Current amount is ${match.displayAmount}. What should the new amount be?`,
      ],
      nextState: {
        id: 'updateExpense',
        step: 'awaitNewAmount',
        data: { ...state.data, matches: state.data.matches, selected: match },
      },
    };
  }

  if (state.step === 'awaitNewAmount') {
    const amount = parseAmount(input);
    const selected = state.data.selected;
    if (!selected?.id || !amount || amount <= 0) {
      return {
        messages: ['Enter a positive amount such as 42.50.'],
        nextState: state,
      };
    }

    await updateExpense(selected.id, { amount, totalAmount: amount });
    return {
      messages: [`Updated the expense to ${currencyFormatter.format(amount)}.`],
      nextState: null,
    };
  }

  return { messages: ['Let’s start over.'], nextState: null };
}

export function getFlowSuggestions(state: FlowState | null): string[] {
  if (!state) {
    return [];
  }

  switch (state.id) {
    case 'expense':
      if (state.step === 'awaitAmount') {
        return EXPENSE_AMOUNT_SUGGESTIONS;
      }
      if (state.step === 'awaitCategory') {
        return [...EXPENSE_CATEGORY_SUGGESTIONS, 'Skip'];
      }
      if (state.step === 'awaitNote') {
        return ['Skip'];
      }
      return [];
    case 'income':
      return [...INCOME_SUGGESTIONS];
    case 'goal':
      if (state.step === 'awaitTitle') {
        return [...GOAL_NAME_SUGGESTIONS];
      }
      if (state.step === 'awaitAmount') {
        return [...GOAL_AMOUNT_SUGGESTIONS];
      }
      return [];
    case 'deleteExpense':
      if (state.step === 'awaitDate') {
        const suggestions = [
          state.data.dateInput,
          ...(state.data.category ? [state.data.category] : []),
          '2024-06-12',
          '2024-06-13',
          ...STANDARD_CATEGORIES.slice(0, 4),
        ].filter(Boolean) as string[];
        return [...new Set(suggestions)];
      }
      if (state.step === 'awaitSelection') {
        return state.data.matches.map((_, index) => String(index + 1));
      }
      return [];
    case 'updateExpense':
      if (state.step === 'awaitDate') {
        const suggestions = [
          state.data.dateInput,
          ...(state.data.category ? [state.data.category] : []),
          '2024-06-12',
          '2024-06-13',
          ...STANDARD_CATEGORIES.slice(0, 4),
        ].filter(Boolean) as string[];
        return [...new Set(suggestions)];
      }
      if (state.step === 'awaitSelection') {
        return state.data.matches.map((_, index) => String(index + 1));
      }
      if (state.step === 'awaitNewAmount') {
        const selectedAmount = state.data.selected?.amount;
        return selectedAmount
          ? [String(selectedAmount), '50', '100']
          : ['25', '50', '75'];
      }
      return [];
    default:
      return [];
  }
}
