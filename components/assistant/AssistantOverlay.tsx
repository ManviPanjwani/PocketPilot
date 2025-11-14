import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import { LinearGradient } from '@/utils/LinearGradient';

import { useAssistant } from '@/assistant/AssistantContext';
import { COMMAND_HELP } from '@/assistant/commandHandlers';
import type { FlowId } from '@/assistant/flows';
import { AppButton } from '@/components/ui/AppButton';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { Palette } from '@/styles/palette';
import { useAppTheme } from '@/styles/ThemeProvider';

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

  const handleSpeechResult = useCallback(
    (transcript: string, isFinal: boolean) => {
      if (!transcript.trim()) return;
      if (isFinal) {
        setInput('');
        void submitCommand(transcript);
      } else {
        setInput(transcript);
      }
    },
    [submitCommand],
  );

  const { supported: speechSupported, listening: speechListening, start: startSpeech, stop: stopSpeech } =
    useSpeechRecognition(handleSpeechResult);

  const handleMicPress = useCallback(() => {
    if (speechListening) {
      stopSpeech();
      return;
    }
    startSpeech();
  }, [speechListening, startSpeech, stopSpeech]);

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

  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <Modal visible={isOpen} animationType="fade" transparent onRequestClose={closeAssistant}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.scrim} activeOpacity={1} onPress={closeAssistant} />
        <LinearGradient
          colors={['#16233c', '#0f192d']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.sheet}>
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
            {grouped.map((message) => {
              const isUser = message.role === 'user';
              return (
                <View
                  key={message.id}
                  style={[styles.messageContainer, isUser ? styles.messageContainerUser : styles.messageContainerAssistant]}>
                  {!isUser ? (
                    <View style={styles.avatarBadge}>
                      <IconSymbol name="sparkles" color={palette.onAccent} size={16} />
                    </View>
                  ) : null}
                  <View style={[styles.messageBubble, isUser ? styles.messageBubbleUser : styles.messageBubbleAssistant]}>
                    <Text
                      style={[styles.messageAuthor, isUser ? styles.messageAuthorUser : styles.messageAuthorAssistant]}>
                      {isUser ? 'You' : 'Assistant'}
                    </Text>
                    <Text style={[styles.messageText, isUser ? styles.messageTextUser : undefined]}>{message.text}</Text>
                  </View>
                </View>
              );
            })}
            {processing ? (
              <View style={[styles.messageContainer, styles.messageContainerAssistant]}>
                <View style={styles.avatarBadge}>
                  <IconSymbol name="sparkles" color={palette.onAccent} size={16} />
                </View>
                <View style={[styles.messageBubble, styles.messageBubbleAssistant]}>
                  <Text style={styles.messageAuthorAssistant}>Assistant</Text>
                  <Text style={styles.messageText}>Working on it…</Text>
                </View>
              </View>
            ) : null}
          </ScrollView>
          {enabled && suggestions.length ? (
            <View style={styles.suggestionsWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.suggestionsRow}>
                {suggestions.map((option) => (
                  <TouchableOpacity
                    key={`suggestion-${option}`}
                    style={styles.suggestionChip}
                    onPress={() => handleSuggestion(option)}>
                    <Text style={styles.suggestionText}>{option}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
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
            {enabled ? (
              <TouchableOpacity
                style={[styles.micButton, speechListening && styles.micButtonActive, !speechSupported && styles.micButtonDisabled]}
                onPress={handleMicPress}
                activeOpacity={0.85}
                disabled={!speechSupported}>
                <IconSymbol
                  name="mic.fill"
                  color={speechSupported ? palette.onAccent : 'rgba(12,18,30,0.7)'}
                  size={18}
                />
              </TouchableOpacity>
            ) : null}
          </View>
          {enabled ? (
            <>
              <View style={styles.controlsRow}>
                <AppButton
                  label="Minimize"
                  variant="secondary"
                  onPress={closeAssistant}
                  style={styles.controlButton}
                />
              </View>
              {!speechSupported ? (
                <Text style={styles.speechNotice}>
                  {Platform.OS === 'web'
                    ? 'Voice input is only available on supported browsers like Chrome (desktop) over HTTPS.'
                    : 'Install the package @react-native-voice/voice and grant microphone permissions to enable voice input on this device.'}
                </Text>
              ) : null}
            </>
          ) : null}
          <Text style={styles.hint}>{COMMAND_HELP}</Text>
        </LinearGradient>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (palette: Palette) =>
  StyleSheet.create({
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
    backgroundColor: 'transparent',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
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
  suggestionsWrapper: {
    marginTop: 12,
  },
  suggestionsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 12,
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
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  controlButton: {
    minWidth: 120,
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124, 131, 255, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(124, 131, 255, 0.45)',
  },
  micButtonActive: {
    backgroundColor: palette.accent,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  micButtonDisabled: {
    opacity: 0.5,
  },
  speechNotice: {
    marginTop: 8,
    color: palette.textMuted,
    fontSize: 12,
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
    gap: 16,
    paddingBottom: 16,
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    alignSelf: 'flex-start',
    maxWidth: '88%',
  },
  messageContainerAssistant: {
    alignSelf: 'flex-start',
  },
  messageContainerUser: {
    flexDirection: 'row-reverse',
    alignSelf: 'flex-end',
  },
  avatarBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  messageBubble: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 6,
  },
  messageBubbleAssistant: {
    backgroundColor: 'rgba(16, 28, 51, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(124, 131, 255, 0.18)',
  },
  messageBubbleUser: {
    backgroundColor: palette.accent,
  },
  messageAuthor: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  messageAuthorAssistant: {
    color: palette.textMuted,
  },
  messageAuthorUser: {
    color: palette.onAccent,
  },
  messageText: {
    color: palette.textPrimary,
    fontSize: 15,
    lineHeight: 20,
  },
  messageTextUser: {
    color: palette.onAccent,
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
