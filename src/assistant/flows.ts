import { addExpense } from '@/services/expenses';
import { addGoal } from '@/services/goals';
import { upsertUserProfile } from '@/services/profile';

import { currencyFormatter, isSkipIntent, parseAmount } from './utils';

export type FlowId = 'expense' | 'income' | 'goal';

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

export type FlowState = ExpenseState | IncomeState | GoalState;

export type FlowInit = {
  state: FlowState;
  intro: string;
};

type FlowAdvanceResult = {
  messages: string[];
  nextState: FlowState | null;
};

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
    const category = isSkipIntent(trimmed) ? undefined : trimmed;
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
