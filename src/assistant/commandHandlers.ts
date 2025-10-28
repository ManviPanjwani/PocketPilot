import { addExpense } from '@/services/expenses';
import { addGoal } from '@/services/goals';
import { upsertUserProfile } from '@/services/profile';

import { FlowId } from './flows';
import { currencyFormatter, parseAmount } from './utils';

export type CommandResult = {
  message: string;
  startFlow?: FlowId;
};

export const COMMAND_HELP =
  'Try commands like "add expense 45 groceries", "set income 5000", or "add goal vacation 1200".';

export async function processAssistantCommand(input: string): Promise<CommandResult> {
  const normalized = input.trim();
  if (!normalized.length) {
    return { message: "I didn't catch that. " + COMMAND_HELP };
  }

  const lower = normalized.toLowerCase();

  // Handle setting monthly income
  if (lower.startsWith('set income') || lower.startsWith('update income')) {
    const amountMatch = normalized.match(/(-?\d+[\d.,]*)/);
    const amount = parseAmount(amountMatch?.[0]);
    if (!amount || amount <= 0) {
      return {
        message: 'Let me walk you through updating income.',
        startFlow: 'income',
      };
    }

    await upsertUserProfile({ monthlyIncome: amount, currency: 'USD' });
    return {
      message: `Got it! I set your monthly income to ${currencyFormatter.format(amount)}.`,
    };
  }

  // Handle expense logging: "add expense 45 groceries note dinner"
  if (lower.startsWith('add expense') || lower.startsWith('log expense')) {
    const tokens = normalized.split(/\s+/);
    const expenseIndex = tokens.findIndex((token) => token.toLowerCase() === 'expense');
    const payloadTokens = tokens.slice(expenseIndex + 1);

    const amountToken = payloadTokens.find((token) => /\d/.test(token));
    const amount = parseAmount(amountToken);
    if (!amount || amount <= 0) {
      return {
        message: 'Let’s capture that expense step-by-step.',
        startFlow: 'expense',
      };
    }

    const amountIndex = payloadTokens.indexOf(amountToken!);
    const remainingTokens = payloadTokens
      .filter((_, idx) => idx !== amountIndex)
      .join(' ')
      .trim();

    let category: string | undefined;
    let note: string | undefined;

    if (remainingTokens.length) {
      const noteMarker = remainingTokens.toLowerCase().indexOf(' note ');
      if (noteMarker >= 0) {
        category = remainingTokens.slice(0, noteMarker).trim();
        note = remainingTokens.slice(noteMarker + 6).trim();
      } else {
        category = remainingTokens;
      }
    }

    await addExpense({
      amount,
      totalAmount: amount,
      category: category?.length ? category : undefined,
      note: note?.length ? note : undefined,
    });

    const categoryText = category?.length ? ` under ${category}` : '';
    return {
      message: `Logged ${currencyFormatter.format(amount)}${categoryText}. Need anything else?`,
    };
  }

  // Handle goals: "add goal vacation 1200" or "create goal emergency fund 2000"
  if (lower.startsWith('add goal') || lower.startsWith('create goal')) {
    const tokens = normalized.split(/\s+/);
    const goalIndex = tokens.findIndex((token) => token.toLowerCase() === 'goal');
    const payloadTokens = tokens.slice(goalIndex + 1);

    if (payloadTokens.length === 0) {
      return {
        message: 'Let me help you set that goal.',
        startFlow: 'goal',
      };
    }

    const lastToken = payloadTokens[payloadTokens.length - 1];
    const target = parseAmount(lastToken);

    if (!target || target <= 0) {
      return {
        message: 'I can guide you through creating that goal.',
        startFlow: 'goal',
      };
    }

    const titleTokens = payloadTokens.slice(0, payloadTokens.length - 1);
    const title = titleTokens.join(' ').trim() || 'New goal';

    await addGoal({
      title,
      targetAmount: target,
    });

    return {
      message: `Created the goal "${title}" with a target of ${currencyFormatter.format(target)}.`,
    };
  }

  if (lower === 'help' || lower.includes('what can you do')) {
    return { message: COMMAND_HELP };
  }

  return {
    message: `I’m not sure how to help with that yet. ${COMMAND_HELP}`,
  };
}
