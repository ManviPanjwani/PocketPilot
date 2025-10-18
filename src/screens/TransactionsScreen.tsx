import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
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

export default function TransactionsScreen() {
  const [items, setItems] = useState<Expense[]>([]);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [totalDraft, setTotalDraft] = useState('');
  const [participantsDraft, setParticipantsDraft] = useState<DraftParticipant[]>([
    createSelfDraft('0.00'),
  ]);
  const [categoryDraft, setCategoryDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [saving, setSaving] = useState(false);

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
        amount: self.amountValue,
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
    if (!expense.id) return;
    Alert.alert(
      'Delete transaction',
      'Are you sure you want to remove this expense?',
      [
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
      ],
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Recent Transactions</Text>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id!}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.rowTop}>${item.amount.toFixed(2)}</Text>
            <Text style={styles.rowSub}>{item.category || 'Uncategorized'}</Text>
            <Text style={styles.timestamp}>{formatTimestamp(item, dateFormatter)}</Text>
            {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
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
              <TouchableOpacity onPress={() => openEditModal(item)}>
                <Text style={styles.actionButton}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmDelete(item)}>
                <Text style={[styles.actionButton, styles.deleteButton]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No expenses yet</Text>}
      />

      <Modal
        visible={Boolean(editingExpense)}
        animationType="slide"
        transparent
        onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
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
              <TouchableOpacity style={styles.modalButton} onPress={closeModal} disabled={saving}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalPrimaryButton]}
                onPress={handleSave}
                disabled={saving}>
                <Text style={[styles.modalButtonText, styles.modalPrimaryButtonText]}>
                  {saving ? 'Saving…' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0f14', padding: 16 },
  title: { color: '#e8f0fe', fontSize: 22, marginBottom: 12 },
  card: { backgroundColor: '#111822', borderRadius: 10, padding: 12 },
  rowTop: { color: '#e8f0fe', fontSize: 18, fontWeight: '600' },
  rowSub: { color: '#8aa0b6', marginTop: 4 },
  timestamp: { color: '#5f7087', marginTop: 2, fontSize: 13 },
  note: { color: '#b7c7d9', marginTop: 4, fontStyle: 'italic' },
  empty: { color: '#8aa0b6', marginTop: 24, textAlign: 'center' },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginTop: 12,
  },
  actionButton: {
    color: '#4c71ff',
    fontWeight: '600',
  },
  deleteButton: {
    color: '#ff6b6b',
  },
  splitSummary: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1f2a36',
    gap: 4,
  },
  splitTotal: {
    color: '#e8f0fe',
    fontWeight: '600',
  },
  splitLine: {
    color: '#8aa0b6',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#111822',
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  modalTitle: {
    color: '#e8f0fe',
    fontSize: 18,
    fontWeight: '600',
  },
  modalLabel: {
    color: '#8aa0b6',
    fontSize: 14,
  },
  modalInput: {
    backgroundColor: '#0b0f14',
    borderRadius: 8,
    padding: 12,
    color: '#e8f0fe',
    borderWidth: 1,
    borderColor: '#1f2a36',
  },
  modalTextarea: {
    height: 90,
    textAlignVertical: 'top',
  },
  modalSplitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  participantCard: {
    backgroundColor: '#111822',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  participantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  participantTitle: {
    color: '#e8f0fe',
    fontWeight: '600',
  },
  removeParticipant: {
    color: '#ff6b6b',
    fontWeight: '600',
  },
  addParticipantButton: {
    paddingVertical: 8,
  },
  addParticipantText: {
    color: '#4c71ff',
    fontWeight: '600',
  },
  differenceBanner: {
    borderRadius: 10,
    padding: 12,
  },
  differenceWarning: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderColor: '#ff6b6b',
    borderWidth: 1,
  },
  differenceResolved: {
    backgroundColor: 'rgba(76, 113, 255, 0.15)',
    borderColor: '#4c71ff',
    borderWidth: 1,
  },
  differenceText: {
    color: '#e8f0fe',
    fontSize: 13,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#1f2a36',
  },
  modalPrimaryButton: {
    backgroundColor: '#4c71ff',
  },
  modalButtonText: {
    color: '#e8f0fe',
    fontWeight: '600',
  },
  modalPrimaryButtonText: {
    color: '#ffffff',
  },
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
