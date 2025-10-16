import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  StyleSheet,
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

export default function TransactionsScreen() {
  const [items, setItems] = useState<Expense[]>([]);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [amountDraft, setAmountDraft] = useState('');
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

  function openEditModal(expense: Expense) {
    setEditingExpense(expense);
    setAmountDraft(String(expense.amount));
    setCategoryDraft(expense.category ?? '');
    setNoteDraft(expense.note ?? '');
  }

  function closeModal() {
    setEditingExpense(null);
    setAmountDraft('');
    setCategoryDraft('');
    setNoteDraft('');
    setSaving(false);
  }

  async function handleSave() {
    if (!editingExpense?.id) return;
    const parsedAmount = Number(amountDraft);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Edit transaction', 'Enter a valid amount.');
      return;
    }

    setSaving(true);
    try {
      await updateExpense(editingExpense.id, {
        amount: parsedAmount,
        category: categoryDraft.trim() || undefined,
        note: noteDraft.trim() || undefined,
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
    <View style={s.container}>
      <Text style={s.title}>Recent Transactions</Text>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id!}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => (
          <View style={s.card}>
            <Text style={s.rowTop}>${item.amount.toFixed(2)}</Text>
            <Text style={s.rowSub}>{item.category || 'Uncategorized'}</Text>
            <Text style={s.timestamp}>
              {formatTimestamp(item, dateFormatter)}
            </Text>
            {item.note ? <Text style={s.note}>{item.note}</Text> : null}
            <View style={s.actionsRow}>
              <TouchableOpacity onPress={() => openEditModal(item)}>
                <Text style={s.actionButton}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmDelete(item)}>
                <Text style={[s.actionButton, s.deleteButton]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={s.empty}>No expenses yet</Text>}
      />
      <Modal
        visible={Boolean(editingExpense)}
        animationType="slide"
        transparent
        onRequestClose={closeModal}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Edit transaction</Text>
            <TextInput
              style={s.modalInput}
              keyboardType="decimal-pad"
              placeholder="Amount"
              value={amountDraft}
              onChangeText={setAmountDraft}
            />
            <TextInput
              style={s.modalInput}
              placeholder="Category (optional)"
              value={categoryDraft}
              onChangeText={setCategoryDraft}
            />
            <TextInput
              style={[s.modalInput, s.modalTextarea]}
              placeholder="Note (optional)"
              value={noteDraft}
              onChangeText={setNoteDraft}
              multiline
            />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalButton} onPress={closeModal} disabled={saving}>
                <Text style={s.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalButton, s.modalPrimaryButton]}
                onPress={handleSave}
                disabled={saving}>
                <Text style={[s.modalButtonText, s.modalPrimaryButtonText]}>
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

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0f14', padding: 16 },
  title: { color: '#e8f0fe', fontSize: 22, marginBottom: 12 },
  card: { backgroundColor: '#111822', borderRadius: 10, padding: 12 },
  rowTop: { color: '#e8f0fe', fontSize: 18, fontWeight: '600' },
  rowSub: { color: '#8aa0b6', marginTop: 4 },
  timestamp: { color: '#5f7087', marginTop: 2, fontSize: 13 },
  note: { color: '#b7c7d9', marginTop: 4, fontStyle: 'italic' },
  empty: { color: '#8aa0b6', marginTop: 24, textAlign: 'center' }
});

s.actionsRow = {
  flexDirection: 'row',
  justifyContent: 'flex-end',
  gap: 16,
  marginTop: 12,
};

s.actionButton = {
  color: '#4c71ff',
  fontWeight: '600',
};

s.deleteButton = {
  color: '#ff6b6b',
};

s.modalOverlay = {
  flex: 1,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  justifyContent: 'center',
  alignItems: 'center',
  padding: 20,
};

s.modalCard = {
  width: '100%',
  backgroundColor: '#111822',
  borderRadius: 16,
  padding: 20,
  gap: 12,
};

s.modalTitle = {
  color: '#e8f0fe',
  fontSize: 18,
  fontWeight: '600',
};

s.modalInput = {
  backgroundColor: '#0b0f14',
  borderRadius: 8,
  padding: 12,
  color: '#e8f0fe',
  borderWidth: 1,
  borderColor: '#1f2a36',
};

s.modalTextarea = {
  height: 90,
  textAlignVertical: 'top',
};

s.modalActions = {
  flexDirection: 'row',
  justifyContent: 'flex-end',
  gap: 12,
  marginTop: 8,
};

s.modalButton = {
  paddingVertical: 10,
  paddingHorizontal: 16,
  borderRadius: 8,
  backgroundColor: '#1f2a36',
};

s.modalPrimaryButton = {
  backgroundColor: '#4c71ff',
};

s.modalButtonText = {
  color: '#e8f0fe',
  fontWeight: '600',
};

s.modalPrimaryButtonText = {
  color: '#ffffff',
};

function formatTimestamp(item: Expense, formatter: Intl.DateTimeFormat) {
  if (item.createdAt && typeof item.createdAt.toDate === 'function') {
    try {
      return formatter.format(item.createdAt.toDate());
    } catch (err) {
      // fall through to ISO parsing
    }
  }

  if (item.createdAtISO) {
    try {
      return formatter.format(new Date(item.createdAtISO));
    } catch (err) {
      return item.createdAtISO;
    }
  }

  return 'Date pending…';
}
