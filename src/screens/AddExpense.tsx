import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, Pressable } from 'react-native';
import { addExpense } from '@/services/expenses';

export default function AddExpense() {
  const [amount, setAmount] = useState('50.00');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const quickAmounts = useMemo(() => [10, 25, 50, 100], []);
  const categories = useMemo(
    () => [
      'Groceries',
      'Rent',
      'Utilities',
      'Dining Out',
      'Transportation',
      'Entertainment',
      'Shopping',
      'Health',
      'Travel',
      'Other',
    ],
    [],
  );

  const formattedAmount = (value: number) => value.toFixed(2);

  function confirmAndSave() {
    const value = Number(amount.trim());
    if (!value || value <= 0) {
      Alert.alert('Add expense', 'Please enter a valid amount.');
      return;
    }

    const summaryLines = [
      `Amount: $${formattedAmount(value)}`,
      `Category: ${category || 'Uncategorized'}`,
      note.trim() ? `Note: ${note.trim()}` : null,
    ].filter(Boolean);

    Alert.alert('Save expense?', summaryLines.join('\n'), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Save',
        onPress: () => persistExpense(value),
      },
    ]);
  }

  async function persistExpense(value: number) {
    const normalizedCategory = category.trim() || undefined;
    const normalizedNote = note.trim() || undefined;
    setBusy(true);
    try {
      await addExpense({
        amount: value,
        category: normalizedCategory,
        note: normalizedNote,
      });

      setAmount(formattedAmount(value));
      setCategory('');
      setNote('');

      Alert.alert('Add expense', 'Expense saved successfully!');
    } catch (error: any) {
      Alert.alert('Add expense', error?.message ?? 'Unable to save this expense.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Add Expense</Text>

      <Text style={styles.label}>Amount *</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 45.00"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
      />

      <View style={styles.quickRow}>
        <Text style={styles.quickLabel}>Quick amounts:</Text>
        <View style={styles.quickChips}>
          {quickAmounts.map((amt) => {
            const display = formattedAmount(amt);
            const isSelected = amount === display;
            return (
              <Pressable
                key={amt}
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => setAmount(display)}>
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                  ${display}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Text style={styles.label}>Category</Text>
      <Pressable
        style={styles.dropdown}
        onPress={() => setShowCategoryPicker((current) => !current)}>
        <Text style={styles.dropdownValue}>
          {category || 'Select a category'}
        </Text>
        <Text style={styles.dropdownCaret}>{showCategoryPicker ? '▲' : '▼'}</Text>
      </Pressable>
      {showCategoryPicker ? (
        <View style={styles.dropdownList}>
          {categories.map((option) => {
            const isSelected = option === category;
            return (
              <Pressable
                key={option}
                style={[styles.dropdownItem, isSelected && styles.dropdownItemSelected]}
                onPress={() => {
                  setCategory(option);
                  setShowCategoryPicker(false);
                }}>
                <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextSelected]}>
                  {option}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            style={styles.dropdownItem}
            onPress={() => {
              setCategory('');
              setShowCategoryPicker(false);
            }}>
            <Text style={styles.dropdownItemText}>Clear selection</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.label}>Note</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Add a memo (optional)"
        value={note}
        onChangeText={setNote}
        multiline
      />

      <Button title={busy ? 'Saving…' : 'Save expense'} onPress={confirmAndSave} disabled={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0f14', padding: 24 },
  heading: { color: '#e8f0fe', fontSize: 24, fontWeight: '700', marginBottom: 16 },
  label: { color: '#8aa0b6', fontSize: 14, marginBottom: 4 },
  input: {
    backgroundColor: '#111822',
    color: '#e8f0fe',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  multiline: {
    height: 90,
    textAlignVertical: 'top',
  },
  quickRow: {
    marginBottom: 16,
  },
  quickLabel: {
    color: '#8aa0b6',
    marginBottom: 6,
  },
  quickChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#111822',
    borderWidth: 1,
    borderColor: '#1f2a36',
  },
  chipSelected: {
    backgroundColor: '#2b3a4a',
    borderColor: '#4c71ff',
  },
  chipText: {
    color: '#8aa0b6',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#e8f0fe',
  },
  dropdown: {
    backgroundColor: '#111822',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1f2a36',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dropdownValue: {
    color: '#e8f0fe',
  },
  dropdownCaret: {
    color: '#4c71ff',
    fontSize: 12,
  },
  dropdownList: {
    backgroundColor: '#101721',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1f2a36',
    marginBottom: 16,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1f2a36',
  },
  dropdownItemSelected: {
    backgroundColor: '#1c2836',
  },
  dropdownItemText: {
    color: '#8aa0b6',
  },
  dropdownItemTextSelected: {
    color: '#e8f0fe',
    fontWeight: '600',
  },
});
