import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { addExpense } from '@/services/expenses';
import { AppButton } from '@/components/ui/AppButton';
import { palette, cardShadow } from '@/styles/palette';
import { Fonts } from '@/constants/theme';

const formatAmount = (value: number) => (Number.isFinite(value) ? value.toFixed(2) : '0.00');

type Participant = {
  id: string;
  name: string;
  amount: string;
};

const createParticipant = (amount: string = '0.00'): Participant => ({
  id: `p-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  name: '',
  amount,
});

const round = (value: number) => Math.round(value * 100) / 100;

export default function AddExpense() {
  const [totalAmount, setTotalAmount] = useState('50.00');
  const [others, setOthers] = useState<Participant[]>([]);
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const quickAmounts = useMemo(() => [25, 50, 75, 100], []);
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

  const totalNumber = Number(totalAmount.trim()) || 0;
  const othersTotal = others.reduce((sum, participant) => {
    const value = Number(participant.amount.trim());
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
  const myShare = Math.max(round(totalNumber - othersTotal), 0);
  const difference = round(totalNumber - (othersTotal + myShare));
  const isSplit = others.length > 0;

  const handleTotalChange = (value: string) => {
    setTotalAmount(value);
  };

  const handleQuickAmount = (value: number) => {
    setTotalAmount(formatAmount(value));
  };

  const toggleSplit = (value: boolean) => {
    if (value) {
      if (others.length === 0) {
        const defaultShare = totalNumber > 0 ? formatAmount(totalNumber / 2) : '0.00';
        setOthers([createParticipant(defaultShare)]);
      }
    } else {
      setOthers([]);
    }
  };

  const addParticipant = () => {
    const remaining = Math.max(totalNumber - othersTotal - myShare, 0);
    const defaultShare = remaining > 0 ? formatAmount(remaining) : '0.00';
    setOthers((prev) => [...prev, createParticipant(defaultShare)]);
  };

  const updateParticipantName = (id: string, name: string) => {
    setOthers((prev) => prev.map((participant) => (participant.id === id ? { ...participant, name } : participant)));
  };

  const updateParticipantAmount = (id: string, amount: string) => {
    setOthers((prev) => prev.map((participant) => (participant.id === id ? { ...participant, amount } : participant)));
  };

  const removeParticipant = (id: string) => {
    setOthers((prev) => prev.filter((participant) => participant.id !== id));
  };

  const splitEqually = () => {
    const participantCount = others.length + 1;
    if (participantCount <= 0) return;

    const share = totalNumber / participantCount;
    const formattedShare = formatAmount(share);

    setOthers((prev) =>
      prev.map((participant) => ({
        ...participant,
        amount: formattedShare,
      })),
    );
  };

  function validateAndSave() {
    const total = Number(totalAmount.trim());
    if (!Number.isFinite(total) || total <= 0) {
      Alert.alert('Add expense', 'Enter a valid total amount.');
      return;
    }

    const parsedOthers = others.map((participant) => ({
      ...participant,
      amountValue: Number(participant.amount.trim()),
    }));

    if (
      parsedOthers.some(
        (participant) => !Number.isFinite(participant.amountValue) || participant.amountValue <= 0,
      )
    ) {
      Alert.alert('Add expense', 'Each participant share must be a positive number.');
      return;
    }

    if (parsedOthers.some((participant) => !participant.name.trim())) {
      Alert.alert('Add expense', 'Every participant needs a name.');
      return;
    }

    if (myShare <= 0) {
      Alert.alert('Add expense', 'Your share must be greater than zero.');
      return;
    }

    const totalShares = parsedOthers.reduce((sum, participant) => sum + participant.amountValue, myShare);
    if (Math.abs(totalShares - total) > 0.01) {
      Alert.alert('Add expense', 'Shares must add up to the total amount.');
      return;
    }

    persistExpense({
      total,
      selfShare: myShare,
      others: parsedOthers,
    });
  }

  async function persistExpense({
    total,
    selfShare,
    others,
  }: {
    total: number;
    selfShare: number;
    others: (Participant & { amountValue: number })[];
  }) {
    setBusy(true);
    try {
      const normalizedCategory = category.trim() || undefined;
      const normalizedNote = note.trim() || undefined;
      const hasSplit = others.length > 0;

      const splits = hasSplit
        ? [
            { label: 'Me', amount: selfShare },
            ...others.map((participant) => ({
              label: participant.name.trim(),
              amount: participant.amountValue,
            })),
          ]
        : undefined;

      await addExpense({
        amount: selfShare,
        category: normalizedCategory,
        note: normalizedNote,
        totalAmount: hasSplit ? total : selfShare,
        splits,
      });

      const resetValue = formatAmount(50);
      setTotalAmount(resetValue);
      setOthers([]);
      setCategory('');
      setNote('');

      Alert.alert('Add expense', 'Expense saved successfully!');
    } catch (error: any) {
      console.error('Failed to save expense', error);
      Alert.alert('Add expense', error?.message ?? 'Unable to save this expense.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <View style={styles.form}>
        <Text style={styles.heading}>Add Expense</Text>

        <Text style={styles.label}>Total amount *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 100.00"
          keyboardType="decimal-pad"
          value={totalAmount}
          onChangeText={handleTotalChange}
        />

        <View style={styles.quickRow}>
          <Text style={styles.quickLabel}>Quick totals:</Text>
          <View style={styles.quickChips}>
            {quickAmounts.map((amt) => {
              const display = formatAmount(amt);
              const selected = totalAmount === display;
              return (
                <Pressable
                  key={amt}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => handleQuickAmount(amt)}>
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    ${display}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.splitToggleRow}>
          <Text style={styles.label}>Split this expense</Text>
          <Switch value={isSplit} onValueChange={toggleSplit} />
        </View>

        <View style={styles.participantCard}>
          <Text style={styles.participantTitle}>Your share *</Text>
          <View style={[styles.input, styles.readOnlyField]}>
            <Text style={styles.readOnlyText}>${formatAmount(myShare)}</Text>
          </View>
        </View>

        {isSplit ? (
          <TouchableOpacity style={styles.equalButton} onPress={splitEqually}>
            <Text style={styles.equalText}>Split equally</Text>
          </TouchableOpacity>
        ) : null}

        {others.map((participant, index) => (
          <View key={participant.id} style={styles.participantCard}>
            <View style={styles.participantHeader}>
              <Text style={styles.participantTitle}>Participant {index + 1}</Text>
              <TouchableOpacity onPress={() => removeParticipant(participant.id)}>
                <Text style={styles.removeParticipant}>Remove</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Name"
              value={participant.name}
              onChangeText={(text) => updateParticipantName(participant.id, text)}
            />
            <TextInput
              style={styles.input}
              placeholder="Amount"
              keyboardType="decimal-pad"
              value={participant.amount}
              onChangeText={(text) => updateParticipantAmount(participant.id, text)}
            />
          </View>
        ))}

        {isSplit ? (
          <TouchableOpacity style={styles.addParticipantButton} onPress={addParticipant}>
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

        <Text style={styles.label}>Category</Text>
        <Pressable
          style={styles.dropdown}
          onPress={() => setShowCategoryPicker((current) => !current)}>
          <Text style={styles.dropdownValue}>{category || 'Select a category'}</Text>
          <Text style={styles.dropdownCaret}>{showCategoryPicker ? '▲' : '▼'}</Text>
        </Pressable>
        {showCategoryPicker ? (
          <View style={styles.dropdownList}>
            {categories.map((option) => {
              const selected = option === category;
              return (
                <Pressable
                  key={option}
                  style={[styles.dropdownItem, selected && styles.dropdownItemSelected]}
                  onPress={() => {
                    setCategory(option);
                    setShowCategoryPicker(false);
                  }}>
                  <Text
                    style={[styles.dropdownItemText, selected && styles.dropdownItemTextSelected]}>
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

        <AppButton
          label="Save expense"
          onPress={validateAndSave}
          loading={busy}
          disabled={busy}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: 24, paddingBottom: 64 },
  form: { flex: 1, gap: 18 },
  heading: {
    color: palette.textPrimary,
    fontSize: 26,
    fontWeight: '700',
    fontFamily: Fonts.rounded,
    marginBottom: 8,
  },
  label: {
    color: palette.textMuted,
    fontSize: 14,
    letterSpacing: 0.2,
  },
  input: {
    backgroundColor: palette.surface,
    color: palette.textPrimary,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
  },
  multiline: {
    height: 110,
    textAlignVertical: 'top',
  },
  quickRow: {
    gap: 8,
  },
  quickLabel: {
    color: palette.textSecondary,
    fontWeight: '600',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  quickChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  chipSelected: {
    backgroundColor: palette.accentMuted,
    borderColor: palette.accentBright,
  },
  chipText: {
    color: palette.textSecondary,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: palette.textPrimary,
  },
  splitToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 6,
  },
  participantCard: {
    backgroundColor: palette.surfaceElevated,
    borderRadius: 18,
    padding: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: palette.border,
    ...cardShadow,
  },
  participantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  participantTitle: {
    color: palette.textPrimary,
    fontWeight: '600',
    fontSize: 15,
  },
  removeParticipant: {
    color: palette.danger,
    fontWeight: '600',
  },
  equalButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: palette.accentMuted,
    borderRadius: 999,
  },
  equalText: {
    color: palette.accentBright,
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
    backgroundColor: 'rgba(248, 113, 113, 0.15)',
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
  readOnlyField: {
    justifyContent: 'center',
    backgroundColor: palette.backgroundAlt,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    padding: 14,
  },
  readOnlyText: {
    color: palette.textSecondary,
    fontWeight: '600',
  },
  dropdown: {
    backgroundColor: palette.surface,
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownValue: {
    color: palette.textPrimary,
  },
  dropdownCaret: {
    color: palette.accentBright,
    fontSize: 12,
  },
  dropdownList: {
    backgroundColor: palette.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    marginTop: 8,
  },
  dropdownItem: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.surfaceMuted,
  },
  dropdownItemSelected: {
    backgroundColor: palette.accentMuted,
  },
  dropdownItemText: {
    color: palette.textSecondary,
  },
  dropdownItemTextSelected: {
    color: palette.textPrimary,
    fontWeight: '600',
  },
});
