import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { observeRecentExpenses, Expense } from '@/services/expenses';

export default function TransactionsScreen() {
  const [items, setItems] = useState<Expense[]>([]);

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
  timestamp: { color: '#5f7087', marginTop: 2, fontSize: 13 },
  note: { color: '#b7c7d9', marginTop: 4, fontStyle: 'italic' },
  empty: { color: '#8aa0b6', marginTop: 24, textAlign: 'center' }
});

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
