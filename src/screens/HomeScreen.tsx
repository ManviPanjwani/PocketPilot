import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { firebaseAuth } from '../firebase';
import { listenAuth, signOutUser } from '../services/auth';
import { observeMonthlySummary, MonthlySummary } from '@/services/expenses';
import { observeUserProfile, upsertUserProfile, UserProfile } from '@/services/profile';
import { observeActivity, ActivityEntry } from '@/services/activity';

let VictoryPie: any;

try {
  const victoryLib = require('victory-native');
  VictoryPie = victoryLib.VictoryPie;
} catch (error) {
  console.warn('Victory charts unavailable, showing summaries only.', error);
}

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat(undefined, {
  style: 'percent',
  maximumFractionDigits: 1,
});

const CATEGORY_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#f97316', '#a855f7', '#14b8a6'];

export default function HomeScreen() {
  const [email, setEmail] = useState<string | null>(firebaseAuth.currentUser?.email ?? null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [summary, setSummary] = useState<MonthlySummary>({
    totalSpent: 0,
    monthlyIncome: 0,
    remainingBudget: 0,
    transactions: 0,
    byCategory: [],
    dailyTotals: [],
  });
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [editingIncome, setEditingIncome] = useState(false);
  const [incomeDraft, setIncomeDraft] = useState('');
  const currency = profile?.currency ?? 'USD';

  const formattedIncome = useMemo(() => {
    if (!profile?.monthlyIncome) return currencyFormatter.format(0);
    return currencyFormatter.format(profile.monthlyIncome);
  }, [profile?.monthlyIncome]);

  useEffect(() => {
    const unsub = listenAuth((user) => setEmail(user?.email ?? null));
    return unsub;
  }, []);

  useEffect(() => {
    const unsubscribeProfile = observeUserProfile((newProfile) => {
      setProfile(newProfile);
      if (newProfile?.monthlyIncome) {
        setIncomeDraft(String(newProfile.monthlyIncome));
      }
    });

    return unsubscribeProfile;
  }, []);

  useEffect(() => {
    const income = profile?.monthlyIncome ?? 0;
    const unsubscribe = observeMonthlySummary(income, setSummary);
    return unsubscribe;
  }, [profile?.monthlyIncome]);

  useEffect(() => {
    const unsubscribe = observeActivity(8, setActivity);
    return unsubscribe;
  }, []);

  const categoryEntries = useMemo(() => {
    if (!summary.byCategory?.length) {
      return [];
    }

    const total = summary.totalSpent;
    const positiveTotals = summary.byCategory
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total);

    if (!positiveTotals.length) {
      return [];
    }

    const fallbackTotal = positiveTotals.reduce((acc, next) => acc + next.total, 0);
    const denominator = total > 0 ? total : fallbackTotal;

    return positiveTotals.map((item, index) => {
      const label = item.category?.trim() ? item.category : 'Uncategorized';
      const paletteColor = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
      const percent = denominator > 0 ? item.total / denominator : 0;

      return {
        category: label,
        total: item.total,
        percent,
        color: paletteColor,
      };
    });
  }, [summary.byCategory, summary.totalSpent]);

  const topCategories = useMemo(() => categoryEntries.slice(0, 4), [categoryEntries]);

  const pieData = useMemo(
    () =>
      categoryEntries.map((item) => ({
        x: item.category,
        y: Number(item.total.toFixed(2)),
      })),
    [categoryEntries],
  );

  const pieColors = useMemo(
    () => categoryEntries.map((item) => item.color),
    [categoryEntries],
  );

  const resolvedPieColors = pieColors.length ? pieColors : CATEGORY_COLORS;

  // Whether Victory is available
  const pieAvailable = Boolean(VictoryPie);

  async function saveIncome() {
    const parsed = Number(incomeDraft);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      Alert.alert('Monthly income', 'Enter a positive number before saving.');
      return;
    }

    try {
      await upsertUserProfile({ monthlyIncome: parsed, currency });
      setEditingIncome(false);
      Alert.alert('Monthly income', 'Income updated successfully.');
    } catch (error: any) {
      Alert.alert('Monthly income', error?.message ?? 'Unable to update income.');
    }
  }

  const spendRatio =
    summary.monthlyIncome > 0 ? Math.min(summary.totalSpent / summary.monthlyIncome, 1) : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back</Text>
          <Text style={styles.email}>{email ?? 'Not signed in'}</Text>
        </View>
        <TouchableOpacity onPress={signOutUser} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Monthly income</Text>
          <TouchableOpacity
            onPress={() => {
              setIncomeDraft(profile?.monthlyIncome ? String(profile.monthlyIncome) : '');
              setEditingIncome((prev) => !prev);
            }}>
            <Text style={styles.editLink}>{editingIncome ? 'Cancel' : 'Edit'}</Text>
          </TouchableOpacity>
        </View>

        {editingIncome ? (
          <>
            <TextInput
              value={incomeDraft}
              onChangeText={setIncomeDraft}
              placeholder="Enter income"
              keyboardType="decimal-pad"
              style={styles.input}
            />
            <Button title="Save income" onPress={saveIncome} />
          </>
        ) : (
          <Text style={styles.highlightValue}>{formattedIncome}</Text>
        )}
        <Text style={styles.caption}>Used to calculate your monthly budget.</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>This month</Text>
          <Text style={styles.cardSubtitle}>
            {summary.transactions} {summary.transactions === 1 ? 'transaction' : 'transactions'}
          </Text>
        </View>

        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Text style={styles.metricLabel}>Total spent</Text>
            <Text style={styles.metricValue}>
              {currencyFormatter.format(summary.totalSpent)}
            </Text>
          </View>
          <View style={styles.rowItem}>
            <Text style={styles.metricLabel}>Remaining</Text>
            <Text style={styles.metricValue}>
              {currencyFormatter.format(summary.remainingBudget)}
            </Text>
          </View>
        </View>

        {summary.monthlyIncome > 0 ? (
          <View style={styles.progressWrapper}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${spendRatio * 100}%` }]} />
            </View>
            <Text style={styles.progressCaption}>
              {percentFormatter.format(spendRatio)} of your budget spent
            </Text>
          </View>
        ) : (
          <Text style={styles.caption}>
            Set a monthly income to track how much of your budget you’ve spent.
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Top categories</Text>
        </View>
        {categoryEntries.length === 0 ? (
          <Text style={styles.caption}>Start adding expenses to see category insights.</Text>
        ) : (
          <View style={styles.categoriesSection}>
            {!pieAvailable ? (
              <Text style={styles.caption}>
                Install `victory-native@36` to view category breakdowns.
              </Text>
            ) : pieData.length === 0 || !pieData.some((d) => d.y > 0) ? (
              <Text style={styles.caption}>No category data with positive totals yet.</Text>
            ) : (
              <View style={styles.chartContainer}>
                <VictoryPie
                  data={pieData}
                  colorScale={resolvedPieColors}
                  width={260}
                  height={260}
                  animate={{ duration: 500 }}
                  innerRadius={60}
                  padAngle={2}
                  cornerRadius={12}
                  labels={({ datum }) => `${datum.x}\n${currencyFormatter.format(datum.y)}`}
                  labelRadius={({ radius }) => radius + 20}
                  style={{
                    data: {
                      // Force colors by index to ensure visible fills
                      fill: ({ index }) => resolvedPieColors[index % resolvedPieColors.length],
                      fillOpacity: 1,
                      strokeWidth: 0,
                    },
                    labels: {
                      fill: '#e8f0fe',
                      fontSize: 12,
                      fontWeight: '600',
                      textAlign: 'center',
                    },
                  }}
                />
              </View>
            )}

            <View style={styles.categoryList}>
              {topCategories.map((item) => (
                <View style={styles.categoryRow} key={item.category}>
                  <View style={styles.categoryMeta}>
                    <View style={[styles.categoryDot, { backgroundColor: item.color }]} />
                    <View>
                      <Text style={styles.categoryLabel}>{item.category}</Text>
                      <Text style={styles.categoryPercent}>
                        {percentFormatter.format(item.percent)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.categoryValue}>
                    {currencyFormatter.format(item.total)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Latest activity</Text>
        </View>
        {activity.length === 0 ? (
          <Text style={styles.caption}>Add expenses or goals to see them here.</Text>
        ) : (
          activity.map((entry) => (
            <View style={styles.activityRow} key={entry.id}>
              <View style={styles.activityMeta}>
                <View
                  style={[
                    styles.activityDot,
                    entry.type === 'goal' ? styles.activityDotGoal : styles.activityDotExpense,
                  ]}
                />
                <View>
                  <Text style={styles.activityTitle}>{entry.title}</Text>
                  <Text style={styles.activitySubtitle}>{describeActivity(entry)}</Text>
                </View>
              </View>
              <Text style={styles.activityAmount}>
                {entry.type === 'goal' ? '+' : '-'}
                {currencyFormatter.format(entry.amount)}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f14',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    color: '#8aa0b6',
    fontSize: 16,
  },
  email: {
    color: '#e8f0fe',
    fontSize: 20,
    fontWeight: '600',
  },
  logoutButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1f2a36',
    backgroundColor: '#111822',
  },
  logoutText: {
    color: '#8aa0b6',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#111822',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    color: '#e8f0fe',
    fontSize: 18,
    fontWeight: '600',
  },
  cardSubtitle: {
    color: '#8aa0b6',
    fontSize: 14,
  },
  caption: {
    color: '#8aa0b6',
    fontSize: 14,
  },
  editLink: {
    color: '#4c71ff',
    fontWeight: '600',
  },
  highlightValue: {
    color: '#e8f0fe',
    fontSize: 32,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#0b0f14',
    borderRadius: 8,
    padding: 12,
    color: '#e8f0fe',
    borderWidth: 1,
    borderColor: '#1f2a36',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  rowItem: {
    flex: 1,
  },
  metricLabel: {
    color: '#8aa0b6',
    fontSize: 14,
  },
  metricValue: {
    color: '#e8f0fe',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 4,
  },
  progressWrapper: {
    gap: 8,
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
  progressCaption: {
    color: '#8aa0b6',
    fontSize: 14,
  },
  categoriesSection: {
    gap: 24,
    alignItems: 'stretch',
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#0f1621',
    borderRadius: 16,
  },
  categoryList: {
    gap: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#101924',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  categoryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4f46e5',
  },
  categoryLabel: {
    color: '#e8f0fe',
    fontSize: 16,
    fontWeight: '600',
  },
  categoryPercent: {
    color: '#8aa0b6',
    fontSize: 13,
    marginTop: 2,
  },
  categoryValue: {
    color: '#e8f0fe',
    fontSize: 16,
    fontWeight: '700',
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  activityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  activityDotExpense: {
    backgroundColor: '#ff7a74',
  },
  activityDotGoal: {
    backgroundColor: '#4c71ff',
  },
  activityTitle: {
    color: '#e8f0fe',
    fontWeight: '600',
  },
  activitySubtitle: {
    color: '#8aa0b6',
    fontSize: 12,
  },
  activityAmount: {
    color: '#e8f0fe',
    fontWeight: '600',
  },
});

function describeActivity(entry: ActivityEntry) {
  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  let timestampLabel = 'recently';
  if (entry.createdAt && typeof entry.createdAt.toDate === 'function') {
    try {
      timestampLabel = formatter.format(entry.createdAt.toDate());
    } catch {
      // ignore
    }
  } else if (entry.createdAtISO) {
    try {
      timestampLabel = formatter.format(new Date(entry.createdAtISO));
    } catch {
      // ignore
    }
  }

  if (entry.type === 'goal') {
    return `Goal created • ${timestampLabel}`;
  }

  const category = entry.snapshot?.category ? ` • ${String(entry.snapshot?.category)}` : '';
  const total = entry.snapshot?.totalAmount;
  const totalText =
    typeof total === 'number' && total !== entry.amount
      ? ` (total ${currencyFormatter.format(total)})`
      : '';
  return `Expense logged${category}${totalText} • ${timestampLabel}`;
}
