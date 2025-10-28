import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
} from 'react-native';

import { Goal, observeGoals, addGoal, deleteGoal } from '@/services/goals';
import { observeMonthlySummary, MonthlySummary } from '@/services/expenses';
import { observeUserProfile, UserProfile } from '@/services/profile';

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const normalizeCategoryLabel = (raw?: string | null, fallback?: string) => {
  const trimmed = raw?.trim();
  if (trimmed && trimmed.length) return trimmed;
  const fallbackTrimmed = fallback?.trim();
  if (fallbackTrimmed && fallbackTrimmed.length) return fallbackTrimmed;
  return 'Uncategorized';
};

export default function GoalsScreen() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('__all');

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

  const normalizeCategoryLabel = (raw?: string | null, fallback?: string) => {
    const trimmed = raw?.trim();
    if (trimmed) return trimmed;
    const fallbackTrimmed = fallback?.trim();
    if (fallbackTrimmed) return fallbackTrimmed;
    return 'Uncategorized';
  };

  const availableCategories = useMemo(() => {
    const set = new Set<string>();

    goals.forEach((goal) => {
      set.add(normalizeCategoryLabel(goal.category, goal.title));
    });

    summary.byCategory.forEach((entry) => {
      const trimmed = entry.category?.trim();
      set.add(trimmed && trimmed.length ? trimmed : 'Uncategorized');
    });

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [goals, summary.byCategory]);

  const filteredGoals = useMemo(() => {
    if (categoryFilter === '__all') return goals;
    return goals.filter((goal) => {
      const label = normalizeCategoryLabel(goal.category, goal.title);
      return label === categoryFilter;
    });
  }, [categoryFilter, goals]);

  const upcomingGoals = useMemo(
    () => filteredGoals.filter((goal) => computeSpent(goal, summary) < goal.targetAmount),
    [filteredGoals, summary],
  );

  const completedGoals = useMemo(
    () => filteredGoals.filter((goal) => computeSpent(goal, summary) >= goal.targetAmount),
    [filteredGoals, summary],
  );

  const listData = useMemo(
    () => [
      { type: 'form' as const, key: 'form' },
      { type: 'filter' as const, key: 'filter' },
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
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !Number.isFinite(parsedTarget) || parsedTarget <= 0) {
      Alert.alert('Create goal', 'Enter a name and a positive target amount.');
      return;
    }

    let normalizedCategory = category.trim();
    if (!normalizedCategory && trimmedTitle) {
      const match = availableCategories.find(
        (cat) => cat.toLowerCase() === trimmedTitle.toLowerCase(),
      );
      if (match) {
        normalizedCategory = match === 'Uncategorized' ? '' : match;
      }
    }

    setSaving(true);
    try {
      await addGoal({
        title: trimmedTitle,
        targetAmount: parsedTarget,
        deadline: deadline.trim() || undefined,
        category: normalizedCategory || undefined,
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

  function nativeConfirm(title: string, message: string): Promise<boolean> {
    if (Platform.OS === 'web') {
      const yes = typeof window !== 'undefined' ? window.confirm(message) : true;
      return Promise.resolve(yes);
    }
    return new Promise((resolve) => {
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
      ]);
    });
  }

  async function confirmDelete(goal: Goal) {
    if (!goal.id) {
      Alert.alert('Delete goal', 'Missing goal id. Please refresh and try again.');
      return;
    }
    const ok = await nativeConfirm('Delete goal', `Are you sure you want to delete “${goal.title}”?`);
    if (!ok) return;
    try {
      console.log('Deleting goal', goal.id);
      await deleteGoal(goal.id);
      Alert.alert('Delete goal', 'Goal deleted.');
    } catch (error: any) {
      console.error('Delete goal error', error);
      Alert.alert('Delete goal', error?.message ?? 'Unable to delete this goal.');
    }
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
          {availableCategories.length ? (
            <View style={styles.suggestionRow}>
              <Text style={styles.caption}>Tap to fill:</Text>
              <View style={styles.filterRow}>
                {availableCategories.map((cat, idx) => (
                  <Pressable
                    key={`suggest-${idx}-${cat}`}
                    style={styles.filterChip}
                    onPress={() => setCategory(cat === 'Uncategorized' ? '' : cat)}>
                    <Text style={styles.filterChipText}>{cat}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
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

    if (item.type === 'filter') {
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Filter by category</Text>
          <View style={styles.filterRow}>
            <Pressable
              style={[styles.filterChip, categoryFilter === '__all' && styles.filterChipSelected]}
              onPress={() => setCategoryFilter('__all')}>
              <Text
                style={[
                  styles.filterChipText,
                  categoryFilter === '__all' && styles.filterChipTextSelected,
                ]}>
                All
              </Text>
            </Pressable>
            {availableCategories.map((cat, idx) => (
              <Pressable
                key={`filter-${idx}-${cat}`}
                style={[
                  styles.filterChip,
                  categoryFilter === cat && styles.filterChipSelected,
                ]}
                onPress={() => setCategoryFilter(cat)}>
                <Text
                  style={[
                    styles.filterChipText,
                    categoryFilter === cat && styles.filterChipTextSelected,
                  ]}>
                  {cat}
                </Text>
              </Pressable>
            ))}
            {availableCategories.length === 0 ? (
              <Text style={styles.caption}>Add goals with categories to filter.</Text>
            ) : null}
          </View>
        </View>
      );
    }

    if (item.type === 'sectionHeader') {
      return <Text style={styles.sectionHeader}>{item.label}</Text>;
    }

    const goal = item.goal;
    const categoryLabel = normalizeCategoryLabel(goal.category, goal.title);
    const spent = computeSpent(goal, summary);
    const progress = goal.targetAmount > 0 ? Math.min(spent / goal.targetAmount, 1) : 0;
    const remaining = Math.max(goal.targetAmount - spent, 0);

    return (
      <View style={styles.card}>
        <View style={styles.goalHeader}>
          <View>
            <Text style={styles.goalTitle}>{goal.title}</Text>
            <Text style={styles.goalMeta}>
              {categoryLabel === 'Uncategorized'
                ? 'Tracking uncategorized spending this month'
                : `Tracking "${categoryLabel}" spending this month`}
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
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1f2a36',
    backgroundColor: '#101721',
  },
  filterChipSelected: {
    borderColor: '#4c71ff',
    backgroundColor: 'rgba(76, 113, 255, 0.15)',
  },
  filterChipText: {
    color: '#8aa0b6',
    fontWeight: '500',
  },
  filterChipTextSelected: {
    color: '#e8f0fe',
  },
  suggestionRow: {
    gap: 8,
  },
});

function computeSpent(goal: Goal, summary: MonthlySummary) {
  const categoryLabel = normalizeCategoryLabel(goal.category, goal.title);
  const hasCategoryValue = Boolean(goal.category && goal.category.trim());
  const hasTitleValue = Boolean(goal.title && goal.title.trim());

  if (!hasCategoryValue && !hasTitleValue) {
    return summary.totalSpent;
  }

  if (categoryLabel === 'Uncategorized') {
    const uncategorized = summary.byCategory.find((item) => !item.category || !item.category.trim());
    if (uncategorized) {
      return uncategorized.total;
    }
    return hasCategoryValue ? 0 : summary.totalSpent;
  }

  const match = summary.byCategory.find((item) => {
    const itemLabel = item.category?.trim();
    return itemLabel && itemLabel.toLowerCase() === categoryLabel.toLowerCase();
  });

  if (!match) {
    return hasCategoryValue ? 0 : summary.totalSpent;
  }

  return match.total;
}
