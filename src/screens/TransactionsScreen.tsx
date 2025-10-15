import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { fetchRecentExpenses, Expense } from '@/services/expenses';

export default function TransactionsScreen() {
  const [items, setItems] = useState<Expense[]>([]);

  useEffect(() => {
    (async () => setItems(await fetchRecentExpenses(50)))();
  }, []);

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
            <Text style={s.rowSub}>{item.category || 'uncategorized'}</Text>
            {item.note ? <Text style={s.note}>{item.note}</Text> : null}
          </View>
        )}
        ListEmptyComponent={<Text style={s.empty}>No expenses yet</Text>}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0f14', padding: 16 },
  title: { color: '#e8f0fe', fontSize: 22, marginBottom: 12 },
  card: { backgroundColor: '#111822', borderRadius: 10, padding: 12 },
  rowTop: { color: '#e8f0fe', fontSize: 18, fontWeight: '600' },
  rowSub: { color: '#8aa0b6', marginTop: 4 },
  note: { color: '#b7c7d9', marginTop: 4, fontStyle: 'italic' },
  empty: { color: '#8aa0b6', marginTop: 24, textAlign: 'center' }
});
