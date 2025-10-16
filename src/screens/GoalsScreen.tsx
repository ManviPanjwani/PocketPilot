import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Goal, observeGoals, addGoal, deleteGoal } from '@/services/goals';
import { observeMonthlySummary, MonthlySummary } from '@/services/expenses';
import { observeUserProfile, UserProfile } from '@/services/profile';

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

export default function GoalsScreen() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [summary, setSummary] = useState<MonthlySummary>({
    totalSpent: 0,
    remainingBudget: 0,
    monthlyIncome: 0,
    transactions: 0,
    byCategory: [],
    dailyTotals: [],
  });

  useEffect(() => {
    const unsubscribe = observeGoals(setGoals);
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribeProfile = observeUserProfile((data) => setProfile(data));
    return unsubscribeProfile;
  }, []);

  useEffect(() => {
    const income = profile?.monthlyIncome ?? 0;
    const unsubscribe = observeMonthlySummary(income, setSummary);
    return unsubscribe;
  }, [profile?.monthlyIncome]);

  const upcomingGoals = useMemo(
    () => goals.filter((goal) => computeSpent(goal, summary) < goal.targetAmount),
    [goals, summary],
  );

  const completedGoals = useMemo(
    () => goals.filter((goal) => computeSpent(goal, summary) >= goal.targetAmount),
    [goals, summary],
  );

  const listData = useMemo(
    () => [
      { type: 'form' as const, key: 'form' },
      ...(upcomingGoals.length
        ? [{ type: 'sectionHeader' as const, key: 'upcoming', label: 'Active goals' }]
        : []),
      ...upcomingGoals.map((goal) => ({ type: 'goal' as const, key: goal.id!, goal })),
      ...(completedGoals.length
        ? [{ type: 'sectionHeader' as const, key: 'completed', label: 'Completed goals' }]
        : []),
      ...completedGoals.map((goal) => ({ type: 'goal' as const, key: goal.id!, goal })),
    ],
    [upcomingGoals, completedGoals],
  );

  async function handleAddGoal() {
    const parsedTarget = Number(target);
    if (!title.trim() || !Number.isFinite(parsedTarget) || parsedTarget <= 0) {
      Alert.alert('Create goal', 'Enter a name and a positive target amount.');
      return;
    }

    setSaving(true);
    try {
      await addGoal({
        title: title.trim(),
        targetAmount: parsedTarget,
        deadline: deadline.trim() || undefined,
        category: category.trim() || undefined,
      });
      setTitle('');
      setTarget('');
      setDeadline('');
      setCategory('');
      Alert.alert('Create goal', 'Goal saved successfully.');
    } catch (error: any) {
      Alert.alert('Create goal', error?.message ?? 'Unable to save this goal.');
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(goal: Goal) {
    Alert.alert(
      'Delete goal',
      `Are you sure you want to delete “${goal.title}”?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteGoal(goal.id!);
            } catch (error: any) {
              Alert.alert('Delete goal', error?.message ?? 'Unable to delete this goal.');
            }
          },
        },
      ],
    );
  }

  function renderItem({ item }: { item: (typeof listData)[number] }) {
    if (item.type === 'form') {
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Create a spending goal</Text>
          <TextInput
            placeholder="Goal name (e.g. Keep dining under $200)"
            value={title}
            onChangeText={setTitle}
            style={styles.input}
          />
          <TextInput
            placeholder="Target amount"
            keyboardType="decimal-pad"
            value={target}
            onChangeText={setTarget}
            style={styles.input}
          />
          <TextInput
            placeholder="Category to track (optional)"
            value={category}
            onChangeText={setCategory}
            style={styles.input}
          />
          <TextInput
            placeholder="Deadline (optional)"
            value={deadline}
            onChangeText={setDeadline}
            style={styles.input}
          />
          <Button
            title={saving ? 'Saving…' : 'Save goal'}
            onPress={handleAddGoal}
            disabled={saving}
          />
          <Text style={styles.caption}>
            Progress updates automatically using your expenses this month. Leave category blank to
            track all spending.
          </Text>
        </View>
      );
    }

    if (item.type === 'sectionHeader') {
      return <Text style={styles.sectionHeader}>{item.label}</Text>;
    }

    const goal = item.goal;
    const spent = computeSpent(goal, summary);
    const progress = goal.targetAmount > 0 ? Math.min(spent / goal.targetAmount, 1) : 0;
    const remaining = Math.max(goal.targetAmount - spent, 0);

    return (
      <View style={styles.card}>
        <View style={styles.goalHeader}>
          <View>
            <Text style={styles.goalTitle}>{goal.title}</Text>
            <Text style={styles.goalMeta}>
              Tracking {goal.category ? `"${goal.category}"` : 'all spending this month'}
            </Text>
            {goal.deadline ? (
              <Text style={styles.goalDeadline}>By {goal.deadline}</Text>
            ) : null}
          </View>
          <Button title="Delete" color="#ff5565" onPress={() => confirmDelete(goal)} />
        </View>

        <Text style={styles.goalSubtitle}>
          {currencyFormatter.format(spent)} / {currencyFormatter.format(goal.targetAmount)}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.goalRemaining}>
          {remaining > 0
            ? `${currencyFormatter.format(remaining)} remaining`
            : 'Goal reached 🎉'}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={listData}
      keyExtractor={(item) => item.key}
      renderItem={renderItem}
      contentContainerStyle={styles.listContent}
      style={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: '#0b0f14',
  },
  listContent: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  sectionHeader: {
    color: '#8aa0b6',
    fontSize: 16,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#111822',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  cardTitle: {
    color: '#e8f0fe',
    fontSize: 18,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#0b0f14',
    borderRadius: 8,
    padding: 12,
    color: '#e8f0fe',
    borderWidth: 1,
    borderColor: '#1f2a36',
  },
  caption: {
    color: '#8aa0b6',
    fontSize: 13,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalTitle: {
    color: '#e8f0fe',
    fontSize: 18,
    fontWeight: '600',
  },
  goalMeta: {
    color: '#8aa0b6',
    marginTop: 4,
  },
  goalDeadline: {
    color: '#8aa0b6',
    marginTop: 2,
  },
  goalSubtitle: {
    color: '#e8f0fe',
    fontSize: 16,
    fontWeight: '500',
  },
  progressTrack: {
    backgroundColor: '#1f2a36',
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: '#4c71ff',
    height: '100%',
    borderRadius: 999,
  },
  goalRemaining: {
    color: '#8aa0b6',
    fontSize: 14,
  },
});

function computeSpent(goal: Goal, summary: MonthlySummary) {
  if (goal.category) {
    const match = summary.byCategory.find(
      (item) => item.category.toLowerCase() === goal.category?.toLowerCase(),
    );
    return match ? match.total : 0;
  }
  return summary.totalSpent;
}
