import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { addExpense } from '@/services/expenses';

export default function AddExpense() {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    const n = Number(amount);
    if (!n || n <= 0) {
      Alert.alert('Enter a valid amount');
      return;
    }
    setBusy(true);
    try {
      await addExpense({ amount: n, category: category || undefined, note: note || undefined });
      setAmount(''); setCategory(''); setNote('');
      Alert.alert('Saved!');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.container}>
      <Text style={s.title}>Add Expense</Text>
      <TextInput
        placeholder="Amount"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
        style={s.input}
      />
      <TextInput
        placeholder="Category (optional)"
        value={category}
        onChangeText={setCategory}
        style={s.input}
      />
      <TextInput
        placeholder="Note (optional)"
        value={note}
        onChangeText={setNote}
        style={s.input}
      />
      <Button title={busy ? 'Saving…' : 'Save'} onPress={save} disabled={busy} />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0f14', padding: 24 },
  title: { color: '#e8f0fe', fontSize: 22, marginBottom: 16 },
  input: { backgroundColor: '#111822', color: '#e8f0fe', padding: 12, borderRadius: 8, marginBottom: 12 }
});
