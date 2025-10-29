import React, { useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAssistant } from '@/assistant/AssistantContext';
import { COMMAND_HELP } from '@/assistant/commandHandlers';
import type { FlowId } from '@/assistant/flows';
import { AppButton } from '@/components/ui/AppButton';
import { palette } from '@/styles/palette';

export function AssistantOverlay() {
  const {
    isOpen,
    closeAssistant,
    messages,
    processing,
    submitCommand,
    enabled,
    startFlow,
    activeFlowId,
    suggestions,
  } = useAssistant();
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const grouped = useMemo(() => messages, [messages]);

  const handleSend = async () => {
    const value = input.trim();
    if (!value) return;
    setInput('');
    await submitCommand(value);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  };

  const handleSuggestion = async (value: string) => {
    if (!value) return;
    setInput('');
    await submitCommand(value);
  };

  const placeholder = !enabled
    ? 'Assistant unavailable while signed out.'
    : activeFlowId
    ? 'Type your answer here…'
    : 'Tell me what to do… (e.g. “Add expense 28 groceries”)';

  const quickActions: Array<{ id: FlowId; label: string }> = [
    { id: 'expense', label: 'Log an expense' },
    { id: 'income', label: 'Update income' },
    { id: 'goal', label: 'Create goal' },
    { id: 'updateExpense', label: 'Edit expense' },
    { id: 'deleteExpense', label: 'Delete expense' },
  ];

  return (
    <Modal visible={isOpen} animationType="fade" transparent onRequestClose={closeAssistant}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.scrim} activeOpacity={1} onPress={closeAssistant} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>PocketPilot Assistant</Text>
            <TouchableOpacity
              onPress={closeAssistant}
              accessibilityRole="button"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.closeButton}>Dismiss</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.quickRow}>
            <Text style={styles.quickLabel}>Need help with?</Text>
            <View style={styles.quickChips}>
              {quickActions.map((action) => (
                <TouchableOpacity
                  key={action.id}
                  style={styles.quickChip}
                  onPress={() => startFlow(action.id)}
                  accessibilityRole="button">
                  <Text style={styles.quickChipText}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {activeFlowId ? (
            <Text style={styles.flowHint}>
              {activeFlowId === 'expense'
                ? 'Let’s log that expense. Answer the prompts below.'
                : activeFlowId === 'income'
                ? 'We’ll update your monthly income — just provide the amount.'
                : 'Tell me about your goal and target amount.'}
            </Text>
          ) : null}
          <ScrollView
            ref={scrollRef}
            style={styles.messages}
            contentContainerStyle={styles.messagesContent}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
            {grouped.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.message,
                  message.role === 'user' ? styles.messageUser : styles.messageAssistant,
                ]}>
                <Text style={styles.messageAuthor}>
                  {message.role === 'user' ? 'You' : 'Assistant'}
                </Text>
                <Text style={styles.messageText}>{message.text}</Text>
              </View>
            ))}
            {processing ? (
              <View style={[styles.message, styles.messageAssistant]}>
                <Text style={styles.messageAuthor}>Assistant</Text>
                <Text style={styles.messageText}>Working on it…</Text>
              </View>
            ) : null}
          </ScrollView>
          {enabled && suggestions.length ? (
            <View style={styles.suggestionsRow}>
              {suggestions.map((option) => (
                <TouchableOpacity
                  key={`suggestion-${option}`}
                  style={styles.suggestionChip}
                  onPress={() => handleSuggestion(option)}>
                  <Text style={styles.suggestionText}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          {enabled ? (
            <View style={styles.controlsRow}>
              <AppButton
                label="Minimize"
                variant="secondary"
                onPress={closeAssistant}
                style={styles.controlButton}
              />
            </View>
          ) : null}
          <View style={styles.inputRow}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={placeholder}
              editable={enabled && !processing}
              style={styles.input}
              placeholderTextColor={palette.textMuted}
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
              returnKeyType="send"
            />
            <AppButton
              label="Send"
              onPress={handleSend}
              disabled={!enabled || processing || !input.trim()}
              style={styles.sendButton}
            />
          </View>
          <Text style={styles.hint}>{COMMAND_HELP}</Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(4, 11, 24, 0.72)',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    width: '100%',
    backgroundColor: palette.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderColor: palette.border,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  quickRow: {
    gap: 10,
    marginBottom: 12,
  },
  quickLabel: {
    color: palette.textSecondary,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  quickChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: palette.accentMuted,
    borderWidth: 1,
    borderColor: palette.border,
  },
  quickChipText: {
    color: palette.accentBright,
    fontWeight: '600',
  },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  suggestionChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: palette.surfaceElevated,
    borderWidth: 1,
    borderColor: palette.border,
  },
  suggestionText: {
    color: palette.textSecondary,
    fontWeight: '600',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  controlButton: {
    minWidth: 120,
  },
  flowHint: {
    color: palette.textMuted,
    fontSize: 13,
    marginBottom: 8,
  },
  sheetTitle: {
    color: palette.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    color: palette.accentBright,
    fontWeight: '600',
  },
  messages: {
    maxHeight: '60%',
  },
  messagesContent: {
    gap: 12,
    paddingBottom: 12,
  },
  message: {
    padding: 14,
    borderRadius: 18,
    gap: 6,
  },
  messageUser: {
    backgroundColor: palette.accent,
    alignSelf: 'flex-end',
  },
  messageAssistant: {
    backgroundColor: palette.surfaceElevated,
    borderWidth: 1,
    borderColor: palette.border,
    alignSelf: 'flex-start',
  },
  messageAuthor: {
    color: palette.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  messageText: {
    color: palette.textPrimary,
    fontSize: 15,
    lineHeight: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  input: {
    flex: 1,
    backgroundColor: palette.surfaceElevated,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.select({ ios: 16, default: 12 }),
    color: palette.textPrimary,
    borderWidth: 1,
    borderColor: palette.border,
  },
  sendButton: {
    minHeight: 48,
  },
  hint: {
    marginTop: 16,
    color: palette.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
});
