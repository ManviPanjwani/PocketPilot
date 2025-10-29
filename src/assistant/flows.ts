import { addExpense, fetchRecentExpenses, updateExpense, deleteExpense } from '@/services/expenses';
import { addGoal } from '@/services/goals';
import { upsertUserProfile } from '@/services/profile';

import {
  STANDARD_CATEGORIES,
  currencyFormatter,
  isDoneIntent,
  isNoIntent,
  isSkipIntent,
  isYesIntent,
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

type SplitParticipant = {
  name: string;
  amount: number;
};

type ExpenseState = {
  id: 'expense';
  step:
    | 'awaitAmount'
    | 'awaitSelfShare'
    | 'awaitSplitDecision'
    | 'awaitParticipant'
    | 'awaitCategory'
    | 'awaitNote';
  data: {
    totalAmount?: number;
    selfShare?: number;
    participants: SplitParticipant[];
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
        state: { id: 'expense', step: 'awaitAmount', data: { participants: [] } },
        intro: 'Let’s log an expense. What was the total amount?',
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
    const total = parseAmount(trimmed);
    if (!total || total <= 0) {
      return {
        messages: ['Enter the total amount as a positive number, e.g. “48.30”.'],
        nextState: state,
      };
    }
    const nextState: ExpenseState = {
      id: 'expense',
      step: 'awaitSelfShare',
      data: { ...state.data, totalAmount: total, participants: [] },
    };
    return {
      messages: [
        `Noted ${currencyFormatter.format(total)}. How much was your share? If you covered it all, repeat the same amount.`,
      ],
      nextState,
    };
  }

  if (state.step === 'awaitSelfShare') {
    const total = state.data.totalAmount ?? 0;
    const selfShare = parseAmount(trimmed);
    if (!selfShare || selfShare <= 0) {
      return {
        messages: ['Enter what you actually paid (e.g. “20”).'],
        nextState: state,
      };
    }
    if (total && selfShare - total > 0.01) {
      return {
        messages: ['Your share can’t be greater than the total. Try again.'],
        nextState: state,
      };
    }

    const remainder = Math.max(total - selfShare, 0);
    const nextState: ExpenseState = {
      id: 'expense',
      step: 'awaitSplitDecision',
      data: { ...state.data, selfShare, participants: state.data.participants ?? [], totalAmount: total || selfShare },
    };
    const prompt = remainder > 0.01
      ? `There’s ${currencyFormatter.format(remainder)} remaining. Did you split this with someone else? (yes/no)`
      : 'Did you split this with someone else? (yes/no)';
    return { messages: [prompt], nextState };
  }

  if (state.step === 'awaitSplitDecision') {
    if (isYesIntent(trimmed)) {
      const total = state.data.totalAmount ?? 0;
      const selfShare = state.data.selfShare ?? total;
      const remainder = Math.max(total - selfShare, 0);
      if (remainder <= 0.01) {
        // nothing left to split
        const nextState: ExpenseState = {
          id: 'expense',
          step: 'awaitCategory',
          data: { ...state.data, participants: state.data.participants ?? [] },
        };
        return {
          messages: ['Looks like nothing is left to split. Which category should I use?'],
          nextState,
        };
      }
      const nextState: ExpenseState = {
        id: 'expense',
        step: 'awaitParticipant',
        data: { ...state.data, participants: state.data.participants ?? [] },
      };
      return {
        messages: [
          'Okay! Add someone in the format “Name amount” (e.g. “Alex 15”). Say “done” when finished.',
        ],
        nextState,
      };
    }

    if (isNoIntent(trimmed) || isSkipIntent(trimmed)) {
      const nextState: ExpenseState = {
        id: 'expense',
        step: 'awaitCategory',
        data: { ...state.data, participants: [] },
      };
      return {
        messages: ['Which category should I use? Say “skip” to leave it uncategorized.'],
        nextState,
      };
    }

    return {
      messages: ['Please answer “yes” or “no”.'],
      nextState: state,
    };
  }

  if (state.step === 'awaitParticipant') {
    if (isDoneIntent(trimmed)) {
      const total = state.data.totalAmount ?? 0;
      const selfShare = state.data.selfShare ?? total;
      const participants = state.data.participants ?? [];
      const othersTotal = participants.reduce((sum, participant) => sum + participant.amount, 0);
      const remainder = total - selfShare - othersTotal;

      if (Math.abs(remainder) > 0.01) {
        const msg = remainder > 0
          ? `We still need to allocate ${currencyFormatter.format(remainder)}. Add another person or adjust amounts.`
          : `You’ve allocated ${currencyFormatter.format(Math.abs(remainder))} too much. Adjust the amounts.`;
        return {
          messages: [msg],
          nextState: state,
        };
      }

      const nextState: ExpenseState = {
        id: 'expense',
        step: 'awaitCategory',
        data: { ...state.data, participants },
      };
      return {
        messages: ['Great! Which category should I use? Say “skip” to leave it uncategorized.'],
        nextState,
      };
    }

    const amountMatch = trimmed.match(/(-?\d[\d.,]*)$/);
    if (!amountMatch) {
      return {
        messages: ['Add someone like “Alex 12.50” or say “done”.'],
        nextState: state,
      };
    }

    const amount = parseAmount(amountMatch[0]);
    if (!amount || amount <= 0) {
      return {
        messages: ['Enter a positive amount, e.g. “Alex 12.50”.'],
        nextState: state,
      };
    }

    const existingParticipants = state.data.participants ?? [];
    const rawName = trimmed.slice(0, amountMatch.index).trim();
    const fallbackName = rawName || `Person ${existingParticipants.length + 1}`;
    const normalizedName = normalizeCategoryInput(fallbackName) ?? fallbackName.replace(/\s+/g, ' ').trim();

    const tentativeParticipants = [...existingParticipants, { name: normalizedName, amount }];
    const total = state.data.totalAmount ?? 0;
    const selfShare = state.data.selfShare ?? total;
    const othersTotal = tentativeParticipants.reduce((sum, participant) => sum + participant.amount, 0);
    const remainder = total - selfShare - othersTotal;

    if (remainder < -0.01) {
      return {
        messages: [
          `That pushes the split over by ${currencyFormatter.format(Math.abs(remainder))}. Try a smaller amount for ${normalizedName}.`,
        ],
        nextState: state,
      };
    }

    const nextState: ExpenseState = {
      id: 'expense',
      step: 'awaitParticipant',
      data: { ...state.data, participants: tentativeParticipants },
    };

    const message = Math.abs(remainder) <= 0.01
      ? 'Nice! Amounts balance out. Say “done” or add another person.'
      : remainder > 0
      ? `Added ${normalizedName}. Still ${currencyFormatter.format(remainder)} unassigned. Add another person or type “done”.`
      : `Added ${normalizedName}, but totals now exceed by ${currencyFormatter.format(Math.abs(remainder))}. Adjust the last amount or type “done” when fixed.`;

    return {
      messages: [message],
      nextState,
    };
  }

  if (state.step === 'awaitCategory') {
    const category = isSkipIntent(trimmed) ? undefined : normalizeCategoryInput(trimmed);
    const nextState: ExpenseState = {
      id: 'expense',
      step: 'awaitNote',
      data: { ...state.data, category, participants: state.data.participants ?? [] },
    };
    return {
      messages: ['Any note you’d like to add? You can also say “skip”.'],
      nextState,
    };
  }

  if (state.step === 'awaitNote') {
    const note = isSkipIntent(trimmed) ? undefined : trimmed;
    const total = state.data.totalAmount ?? state.data.selfShare ?? 0;
    const selfShare = state.data.selfShare ?? total;
    const participants = state.data.participants ?? [];

    const splits = participants.length
      ? [
          { label: 'Me', amount: selfShare },
          ...participants.map((participant) => ({ label: participant.name, amount: participant.amount })),
        ]
      : undefined;

    await addExpense({
      amount: selfShare,
      totalAmount: splits ? total : selfShare,
      category: state.data.category,
      note,
      splits,
    });
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
      if (state.step === 'awaitSelfShare') {
        const total = state.data.totalAmount ?? 0;
        const half = total > 0 ? (total / 2).toFixed(2) : undefined;
        const suggestions = [total > 0 ? total.toFixed(2) : undefined, half].filter(Boolean) as string[];
        return suggestions.length ? suggestions : EXPENSE_AMOUNT_SUGGESTIONS;
      }
      if (state.step === 'awaitSplitDecision') {
        return ['Yes', 'No'];
      }
      if (state.step === 'awaitParticipant') {
        const participants = state.data.participants ?? [];
        const total = state.data.totalAmount ?? 0;
        const selfShare = state.data.selfShare ?? total;
        const assigned = participants.reduce((sum, participant) => sum + participant.amount, 0);
        const remaining = Math.max(total - selfShare - assigned, 0);
        const amountSuggestion = remaining > 0 ? remaining.toFixed(2) : '10';
        const nextIndex = participants.length + 1;
        return ['Done', `Friend ${nextIndex} ${amountSuggestion}`];
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
