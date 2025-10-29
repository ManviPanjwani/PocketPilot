import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from 'react';

import { processAssistantCommand } from './commandHandlers';
import { FlowId, FlowState, getFlowSuggestions, handleFlowInput, initFlow } from './flows';
import { isExitIntent } from './utils';

export type AssistantMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: number;
};

type AssistantContextValue = {
  enabled: boolean;
  isOpen: boolean;
  messages: AssistantMessage[];
  processing: boolean;
  error: string | null;
  activeFlowId: FlowId | null;
  suggestions: string[];
  openAssistant: () => void;
  closeAssistant: () => void;
  toggleAssistant: () => void;
  submitCommand: (input: string) => Promise<void>;
  setError: (value: string | null) => void;
  startFlow: (flowId: FlowId) => void;
};

const AssistantContext = createContext<AssistantContextValue | undefined>(undefined);

type Props = {
  children: ReactNode;
  enabled?: boolean;
};

export function AssistantProvider({ children, enabled = true }: Props) {
  const [isOpen, setOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([{
    id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role: 'assistant',
    text: 'Hi! I can log expenses, set your monthly income, or create savings goals. Tell me what you need.',
    timestamp: Date.now(),
  }]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFlow, setActiveFlow] = useState<FlowState | null>(null);

  const defaultSuggestions = useMemo(
    () => [
      'Add expense 25 groceries',
      'Set income 5000',
      'Add goal vacation 1200',
      'Update expense',
      'Delete expense',
    ],
    [],
  );

  const appendAssistantMessages = useCallback((texts: string[]) => {
    const cleaned = texts.filter((text) => text && text.trim().length);
    if (!cleaned.length) return;
    const timestamp = Date.now();
    setMessages((prev) => [
      ...prev,
      ...cleaned.map((text, idx) => ({
        id: `assistant-${timestamp}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
        role: 'assistant',
        text,
        timestamp: timestamp + idx,
      })),
    ]);
  }, []);

  const openAssistant = useCallback(() => {
    setOpen((prev) => {
      if (!enabled && !prev) {
        appendAssistantMessages(['Sign in to let me make changes for you.']);
      }
      return true;
    });
  }, [appendAssistantMessages, enabled]);

  const closeAssistant = useCallback(() => {
    setOpen(false);
  }, []);

  const toggleAssistant = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (next && !enabled) {
        appendAssistantMessages(['Sign in to let me make changes for you.']);
      }
      return next;
    });
  }, [appendAssistantMessages, enabled]);

  const startFlow = useCallback(
    (flowId: FlowId) => {
      if (!enabled) {
        appendAssistantMessages(['Sign in to start that task.']);
        return;
      }
      const { state, intro } = initFlow(flowId);
      setActiveFlow(state);
      setError(null);
      setOpen(true);
      appendAssistantMessages([intro]);
    },
    [appendAssistantMessages, enabled],
  );

  const submitCommand = useCallback(
    async (input: string) => {
      const trimmed = input.trim();
      if (!trimmed || processing) return;

      const normalized = trimmed.toLowerCase();
      const wantsExit = isExitIntent(trimmed);
      const shouldExit = wantsExit || (!activeFlow && normalized === 'no');

      const userMessage: AssistantMessage = {
        id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: 'user',
        text: trimmed,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setProcessing(true);
      setError(null);

      try {
        if (shouldExit) {
          if (activeFlow) {
            appendAssistantMessages(['No problem, cancelling that.']);
            setActiveFlow(null);
          } else {
            appendAssistantMessages(['Understood. I’ll hide for now.']);
          }
          setTimeout(() => setOpen(false), 250);
          return;
        }

        if (activeFlow) {
          const { messages: flowReplies, nextState } = await handleFlowInput(activeFlow, trimmed);
          appendAssistantMessages(flowReplies);
          setActiveFlow(nextState);
          return;
        }

        const response = await processAssistantCommand(trimmed);
        if (response.message) {
          appendAssistantMessages([response.message]);
        }
        if (response.startFlow) {
          startFlow(response.startFlow);
        }
      } catch (err: any) {
        const fallback = err?.message ?? 'I ran into an issue handling that request.';
        appendAssistantMessages([fallback]);
        setError(err?.message ?? 'Something went wrong');
        if (activeFlow) {
          setActiveFlow(null);
        }
      } finally {
        setProcessing(false);
      }
    },
    [processing, activeFlow, appendAssistantMessages, startFlow],
  );

  const value = useMemo<AssistantContextValue>(
    () => ({
      enabled,
      isOpen,
      messages,
      processing,
      error,
      activeFlowId: activeFlow?.id ?? null,
      suggestions: activeFlow ? getFlowSuggestions(activeFlow) : defaultSuggestions,
      openAssistant,
      closeAssistant,
      toggleAssistant,
      submitCommand,
      setError,
      startFlow,
    }),
    [
      enabled,
      isOpen,
      messages,
      processing,
      error,
      activeFlow,
      defaultSuggestions,
      openAssistant,
      closeAssistant,
      toggleAssistant,
      submitCommand,
      startFlow,
    ],
  );

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

export function useAssistant() {
  const ctx = useContext(AssistantContext);
  if (!ctx) {
    throw new Error('useAssistant must be used within an AssistantProvider');
  }
  return ctx;
}
