import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  observeRecentExpenses,
  Expense,
  updateExpense,
  deleteExpense,
} from '@/services/expenses';
import { AppButton } from '@/components/ui/AppButton';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { LinearGradient } from '@/utils/LinearGradient';
import { cardShadow, Palette } from '@/styles/palette';
import { Fonts } from '@/constants/theme';
import { useAppTheme } from '@/styles/ThemeProvider';

const formatAmount = (value: number) => (Number.isFinite(value) ? value.toFixed(2) : '0.00');

const SELF_ID = 'self';

const createSelfDraft = (amount: string) => ({
  id: SELF_ID,
  name: 'Me',
  amount,
  isSelf: true,
});

const createParticipantDraft = (amount: string = '0.00') => ({
  id: `p-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  name: '',
  amount,
});

type DraftParticipant = ReturnType<typeof createParticipantDraft> | ReturnType<typeof createSelfDraft>;

const RANGE_OPTIONS = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: 'all', label: 'All time' },
] as const;

type RangeFilter = (typeof RANGE_OPTIONS)[number]['id'];

export default function TransactionsScreen() {
  const { palette, mode } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [items, setItems] = useState<Expense[]>([]);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [totalDraft, setTotalDraft] = useState('');
  const [participantsDraft, setParticipantsDraft] = useState<DraftParticipant[]>([
    createSelfDraft('0.00'),
  ]);
  const [categoryDraft, setCategoryDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [range, setRange] = useState<RangeFilter>('all');

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [],
  );

  useEffect(() => {
    const unsubscribe = observeRecentExpenses(50, setItems);
    return unsubscribe;
  }, []);

  const filteredItems = useMemo(() => {
    if (range === 'all') return items;
    const days = range === '7d' ? 7 : 30;
    const now = Date.now();
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    return items.filter((expense) => {
      const created = getExpenseDate(expense);
      if (!created) return true;
      return created.getTime() >= cutoff;
    });
  }, [items, range]);

  const summary = useMemo(() => {
    if (!filteredItems.length) {
      return { total: 0, avg: 0, entries: 0, topCategory: '—' };
    }
    const total = filteredItems.reduce((sum, expense) => sum + expense.amount, 0);
    const entries = filteredItems.length;
    const avg = total / entries;
    const categoryMap = new Map<string, number>();
    filteredItems.forEach((expense) => {
      const key = expense.category || 'Uncategorized';
      categoryMap.set(key, (categoryMap.get(key) || 0) + expense.amount);
    });
    const topCategory =
      Array.from(categoryMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
    return { total, avg, entries, topCategory };
  }, [filteredItems]);

  const totalNumber = Number(totalDraft.trim()) || 0;
  const others = participantsDraft.filter((participant) => !participant.isSelf);
  const othersTotal = others.reduce((sum, participant) => {
    const value = Number(participant.amount.trim());
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
  const selfShare = Math.max(Number(participantsDraft.find((participant) => participant.isSelf)?.amount.trim()) || totalNumber - othersTotal, 0);
  const difference = totalNumber - (othersTotal + selfShare);
  const isSplitDraft = others.length > 0;

  const updateParticipantDraft = (id: string, partial: Partial<DraftParticipant>) => {
    setParticipantsDraft((prev) =>
      prev.map((participant) =>
        participant.id === id ? { ...participant, ...partial } : participant,
      ),
    );
  };

  const removeParticipantDraft = (id: string) => {
    setParticipantsDraft((prev) => prev.filter((participant) => participant.id !== id));
  };

  const addParticipantDraft = () => {
    const remaining = formatAmount(Math.max(totalNumber - othersTotal - selfShare, 0));
    setParticipantsDraft((prev) => [...prev, createParticipantDraft(remaining)]);
  };

  const toggleSplitDraft = (value: boolean) => {
    if (value) {
      if (!isSplitDraft) {
        const halfShare = totalNumber > 0 ? formatAmount(totalNumber / 2) : '0.00';
        setParticipantsDraft([createSelfDraft(halfShare), createParticipantDraft(halfShare)]);
      }
    } else {
      setParticipantsDraft([createSelfDraft(formatAmount(totalNumber))]);
    }
  };

  function openEditModal(expense: Expense) {
    const total =
      expense.totalAmount ??
      expense.splits?.reduce((acc, split) => acc + split.amount, 0) ??
      expense.amount;

    const splits = expense.splits?.length
      ? expense.splits
      : [{ label: 'Me', amount: expense.amount }];

    const selfSplit = splits.find((split) => split.label === 'Me');
    const othersSplits = splits.filter((split) => split.label !== 'Me');

    const draftParticipants: DraftParticipant[] = [
      createSelfDraft(formatAmount(selfSplit ? selfSplit.amount : expense.amount)),
      ...othersSplits.map((split) => ({
        id: `p-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: split.label || '',
        amount: formatAmount(split.amount),
      })),
    ];

    setEditingExpense(expense);
    setTotalDraft(formatAmount(total));
    setParticipantsDraft(draftParticipants);
    setCategoryDraft(expense.category ?? '');
    setNoteDraft(expense.note ?? '');
    setSaving(false);
  }

  function closeModal() {
    setEditingExpense(null);
    setTotalDraft('');
    setParticipantsDraft([createSelfDraft('0.00')]);
    setCategoryDraft('');
    setNoteDraft('');
    setSaving(false);
  }

  async function handleSave() {
    if (!editingExpense?.id) return;

    const total = Number(totalDraft.trim());
    if (!Number.isFinite(total) || total <= 0) {
      Alert.alert('Edit transaction', 'Enter a valid total amount.');
      return;
    }

    const parsedParticipants = participantsDraft.map((participant) => ({
      ...participant,
      amountValue: Number(participant.amount.trim()),
    }));

    if (
      parsedParticipants.some(
        (participant) => !Number.isFinite(participant.amountValue) || participant.amountValue <= 0,
      )
    ) {
      Alert.alert('Edit transaction', 'Each share must be a positive number.');
      return;
    }

    const self = parsedParticipants.find((participant) => participant.isSelf);
    if (!self) {
      Alert.alert('Edit transaction', 'Unable to determine your share.');
      return;
    }

    const othersParticipants = parsedParticipants.filter((participant) => !participant.isSelf);

    if (othersParticipants.some((participant) => !participant.name.trim())) {
      Alert.alert('Edit transaction', 'Every participant needs a name.');
      return;
    }

    const totalShares = parsedParticipants.reduce(
      (sum, participant) => sum + participant.amountValue,
      0,
    );

    if (Math.abs(totalShares - total) > 0.01) {
      Alert.alert('Edit transaction', 'Shares must add up to the total amount.');
      return;
    }

    setSaving(true);
    try {
      const hasSplit = othersParticipants.length > 0;
      const amountToStore = hasSplit ? total : self.amountValue;

      const splits = hasSplit
        ? [
            { label: 'Me', amount: self.amountValue },
            ...othersParticipants.map((participant) => ({
              label: participant.name.trim(),
              amount: participant.amountValue,
            })),
          ]
        : [];

      await updateExpense(editingExpense.id, {
        amount: amountToStore,
        category: categoryDraft.trim() || undefined,
        note: noteDraft.trim() || undefined,
        totalAmount: hasSplit ? total : self.amountValue,
        splits,
      });

      closeModal();
    } catch (error: any) {
      Alert.alert('Edit transaction', error?.message ?? 'Unable to update expense.');
      setSaving(false);
    }
  }

  function confirmDelete(expense: Expense) {
    if (!expense.id) {
      Alert.alert('Delete transaction', 'Missing expense id. Refresh and try again.');
      return;
    }

    if (Platform.OS === 'web') {
      const shouldDelete =
        typeof window !== 'undefined'
          ? window.confirm('Delete this expense?')
          : true;
      if (shouldDelete) {
        deleteExpense(expense.id).catch((error) => {
          Alert.alert('Delete transaction', error?.message ?? 'Unable to delete expense.');
        });
      }
      return;
    }

    Alert.alert('Delete transaction', 'Are you sure you want to remove this expense?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteExpense(expense.id!);
          } catch (error: any) {
            Alert.alert('Delete transaction', error?.message ?? 'Unable to delete expense.');
          }
        },
      },
    ]);
  }

  const backgroundGradient = mode === 'light' ? ['#eef3ff', '#dae3ff'] : ['#030b18', '#101c2f'];
  const heroGradient = mode === 'light' ? ['#e8edff', '#d3ddff'] : ['#0b1430', '#0d1a3f'];
  const rangeLabel = RANGE_OPTIONS.find((opt) => opt.id === range)?.label ?? 'All time';

  return (
    <LinearGradient colors={backgroundGradient} style={styles.background}>
      <View style={styles.container}>
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id!}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
          ListHeaderComponent={
            <View style={styles.header}>
              <LinearGradient colors={heroGradient} style={styles.summaryCard}>
                <View style={styles.heroHeader}>
                  <View>
                    <Text style={styles.summaryEyebrow}>Transactions</Text>
                    <Text style={styles.title}>Command center</Text>
                    <Text style={styles.summaryMeta}>
                      {summary.entries} {summary.entries === 1 ? 'entry' : 'entries'} in {rangeLabel}
                    </Text>
                  </View>
                  <View style={styles.heroBadge}>
                    <IconSymbol name="sparkles" size={16} color={palette.accent} />
                    <Text style={styles.heroBadgeText}>{summary.topCategory}</Text>
                  </View>
                </View>
                <View style={styles.summaryGrid}>
                  <View style={styles.summaryTile}>
                    <Text style={styles.summaryTileLabel}>Spent</Text>
                    <Text style={styles.summaryTileValue}>${summary.total.toFixed(2)}</Text>
                  </View>
                  <View style={styles.summaryTile}>
                    <Text style={styles.summaryTileLabel}>Average</Text>
                    <Text style={styles.summaryTileValue}>${summary.avg.toFixed(2)}</Text>
                  </View>
                  <View style={styles.summaryTile}>
                    <Text style={styles.summaryTileLabel}>Top category</Text>
                    <Text style={styles.summaryTileValue}>{summary.topCategory}</Text>
                  </View>
                </View>
              </LinearGradient>
              <View style={styles.filterRow}>
                {RANGE_OPTIONS.map((option) => {
                  const active = option.id === range;
                  return (
                    <TouchableOpacity
                      key={option.id}
                      style={[styles.filterChip, active && styles.filterChipActive]}
                      onPress={() => setRange(option.id)}>
                      <Text style={[styles.filterText, active && styles.filterTextActive]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.title}>Recent Transactions</Text>
            </View>
          }
          ListHeaderComponentStyle={{ marginBottom: 16 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardAmount}>${item.amount.toFixed(2)}</Text>
                <Text style={styles.cardCategory}>{item.category || 'Uncategorized'}</Text>
              </View>
              <View style={styles.cardTime}>
                <IconSymbol name="clock.fill" size={16} color={palette.textMuted} />
                <Text style={styles.timestamp}>{formatTimestamp(item, dateFormatter)}</Text>
              </View>
            </View>
            {item.note ? (
              <View style={styles.notePill}>
                <IconSymbol name="paperplane.fill" size={14} color={palette.accentBright} />
                <Text style={styles.note}>{item.note}</Text>
              </View>
            ) : null}
            {Array.isArray(item.splits) && item.splits.length > 0 ? (
              <View style={styles.splitSummary}>
                <Text style={styles.splitTotal}>
                  Total: ${formatAmount(item.totalAmount ?? item.splits.reduce((sum, split) => sum + split.amount, 0))}
                </Text>
                {item.splits.map((split) => (
                  <Text key={`${item.id}-${split.label}`} style={styles.splitLine}>
                    {split.label}: ${formatAmount(split.amount)}
                  </Text>
                ))}
              </View>
            ) : null}
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionPill} onPress={() => openEditModal(item)}>
                <Text style={styles.actionButton}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionPill, styles.deletePill]}
                onPress={() => confirmDelete(item)}>
                <Text style={[styles.actionButton, styles.deleteButton]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No expenses yet — log one to see it land here.</Text>
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      />

      <Modal
        visible={Boolean(editingExpense)}
        animationType="slide"
        transparent
        onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Edit transaction</Text>

              <Text style={styles.modalLabel}>Total amount *</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="decimal-pad"
                placeholder="Total"
                value={totalDraft}
                onChangeText={(text) => {
                  setTotalDraft(text);
                }}
              />

              <View style={styles.modalSplitRow}>
                <Text style={styles.modalLabel}>Split expense</Text>
                <Switch value={isSplitDraft} onValueChange={toggleSplitDraft} />
              </View>

              {participantsDraft.map((participant, index) => (
                <View key={participant.id} style={styles.participantCard}>
                  <View style={styles.participantHeader}>
                    <Text style={styles.participantTitle}>
                      {participant.isSelf ? 'Your share *' : `Participant ${index}`}
                    </Text>
                    {!participant.isSelf && (
                      <TouchableOpacity onPress={() => removeParticipantDraft(participant.id)}>
                        <Text style={styles.removeParticipant}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {!participant.isSelf && (
                    <TextInput
                      style={styles.modalInput}
                      placeholder="Name"
                      value={participant.name}
                      onChangeText={(text) => updateParticipantDraft(participant.id, { name: text })}
                    />
                  )}

                  <TextInput
                    style={styles.modalInput}
                    keyboardType="decimal-pad"
                    placeholder="Share"
                    value={participant.amount}
                    onChangeText={(text) => updateParticipantDraft(participant.id, { amount: text })}
                  />
                </View>
              ))}

              {isSplitDraft ? (
                <TouchableOpacity style={styles.addParticipantButton} onPress={addParticipantDraft}>
                  <Text style={styles.addParticipantText}>+ Add participant</Text>
                </TouchableOpacity>
              ) : null}

              <View
                style={[
                  styles.differenceBanner,
                  Math.abs(difference) > 0.01
                    ? styles.differenceWarning
                    : styles.differenceResolved,
                ]}>
                <Text style={styles.differenceText}>
                  {Math.abs(difference) > 0.01
                    ? `Adjust shares by $${formatAmount(Math.abs(difference))} to match the total.`
                    : 'All shares add up to the total.'}
                </Text>
              </View>

              <TextInput
                style={styles.modalInput}
                placeholder="Category (optional)"
                value={categoryDraft}
                onChangeText={setCategoryDraft}
              />
              <TextInput
                style={[styles.modalInput, styles.modalTextarea]}
                placeholder="Note (optional)"
                value={noteDraft}
                onChangeText={setNoteDraft}
                multiline
              />

              <View style={styles.modalActions}>
                <AppButton
                  label="Cancel"
                  variant="secondary"
                  onPress={closeModal}
                  disabled={saving}
                  style={styles.modalActionButton}
                />
                <AppButton
                  label="Save"
                  onPress={handleSave}
                  loading={saving}
                  disabled={saving}
                  style={[styles.modalActionButton, styles.modalPrimaryAction]}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      </View>
    </LinearGradient>
  );
}

const createStyles = (palette: Palette) =>
  StyleSheet.create({
  background: { flex: 1 },
  container: { flex: 1, padding: 24 },
  header: { gap: 12 },
  summaryCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 12,
    ...cardShadow,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  summaryEyebrow: {
    color: palette.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  summaryMeta: {
    color: palette.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
  },
  filterChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
  },
  filterChipActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  filterText: {
    color: palette.textSecondary,
    fontWeight: '600',
  },
  filterTextActive: {
    color: palette.onAccent,
  },
  title: {
    color: palette.textPrimary,
    fontSize: 26,
    fontWeight: '800',
    fontFamily: Fonts.rounded,
    marginBottom: 8,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 12,
    ...cardShadow,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  cardAmount: { color: palette.textPrimary, fontSize: 22, fontWeight: '700' },
  cardCategory: {
    marginTop: 4,
    color: palette.textSecondary,
    fontWeight: '600',
  },
  cardTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timestamp: { color: palette.textMuted, marginTop: 2, fontSize: 13 },
  notePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 14,
    backgroundColor: palette.surfaceElevated,
  },
  note: { color: palette.textSecondary, flex: 1 },
  empty: { color: palette.textSecondary, marginTop: 32, textAlign: 'center' },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  actionButton: {
    color: palette.accentBright,
    fontWeight: '600',
  },
  actionPill: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  deletePill: {
    borderColor: palette.danger,
    backgroundColor: palette.surface,
  },
  deleteButton: {
    color: palette.danger,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryTile: {
    flex: 1,
    minWidth: 120,
    backgroundColor: palette.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: palette.border,
  },
  summaryTileLabel: {
    color: palette.textMuted,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  summaryTileValue: {
    color: palette.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  heroBadgeText: {
    color: palette.textPrimary,
    fontWeight: '700',
  },
  splitSummary: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.surfaceMuted,
    gap: 6,
  },
  splitTotal: {
    color: palette.textPrimary,
    fontWeight: '600',
  },
  splitLine: {
    color: palette.textSecondary,
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(4, 11, 24, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: palette.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    ...cardShadow,
  },
  modalContent: {
    padding: 24,
    gap: 16,
  },
  modalTitle: {
    color: palette.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  modalLabel: {
    color: palette.textSecondary,
    fontSize: 14,
  },
  modalInput: {
    backgroundColor: palette.surfaceElevated,
    borderRadius: 14,
    padding: 14,
    color: palette.textPrimary,
    borderWidth: 1,
    borderColor: palette.border,
  },
  modalTextarea: {
    height: 100,
    textAlignVertical: 'top',
  },
  modalSplitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  participantCard: {
    backgroundColor: palette.surfaceElevated,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: palette.border,
  },
  participantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  participantTitle: {
    color: palette.textPrimary,
    fontWeight: '600',
  },
  removeParticipant: {
    color: palette.danger,
    fontWeight: '600',
  },
  addParticipantButton: {
    paddingVertical: 8,
  },
  addParticipantText: {
    color: palette.accentBright,
    fontWeight: '600',
  },
  differenceBanner: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  differenceWarning: {
    backgroundColor: palette.surface,
    borderColor: palette.danger,
  },
  differenceResolved: {
    backgroundColor: palette.accentMuted,
    borderColor: palette.accentBright,
  },
  differenceText: {
    color: palette.textPrimary,
    fontSize: 13,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalActionButton: {
    flex: 1,
  },
  modalPrimaryAction: {},
  });

function formatTimestamp(item: Expense, formatter: Intl.DateTimeFormat) {
  if (item.createdAt && typeof item.createdAt.toDate === 'function') {
    try {
      return formatter.format(item.createdAt.toDate());
    } catch {
      // ignore
    }
  }

  if (item.createdAtISO) {
    try {
      return formatter.format(new Date(item.createdAtISO));
    } catch {
      return item.createdAtISO;
    }
  }

  return 'Date pending…';
}

function getExpenseDate(item: Expense): Date | null {
  if (item.createdAt && typeof item.createdAt.toDate === 'function') {
    try {
      return item.createdAt.toDate();
    } catch {
      return null;
    }
  }
  if (item.createdAtISO) {
    const date = new Date(item.createdAtISO);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}
