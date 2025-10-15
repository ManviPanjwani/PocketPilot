import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { firebaseAuth } from '../firebase';
import { listenAuth, signOutUser } from '../services/auth';
import { observeMonthlySummary, MonthlySummary } from '@/services/expenses';
import { observeUserProfile, upsertUserProfile, UserProfile } from '@/services/profile';

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat(undefined, {
  style: 'percent',
  maximumFractionDigits: 1,
});

export default function HomeScreen() {
  const [email, setEmail] = useState<string | null>(firebaseAuth.currentUser?.email ?? null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [summary, setSummary] = useState<MonthlySummary>({
    totalSpent: 0,
    monthlyIncome: 0,
    remainingBudget: 0,
    transactions: 0,
    byCategory: [],
  });
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

  const topCategories = useMemo(() => {
    const total = summary.totalSpent || 1;
    return summary.byCategory
      .sort((a, b) => b.total - a.total)
      .slice(0, 4)
      .map((item) => ({
        ...item,
        percent: item.total / total,
      }));
  }, [summary.byCategory, summary.totalSpent]);

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
        {summary.totalSpent === 0 ? (
          <Text style={styles.caption}>Start adding expenses to see category insights.</Text>
        ) : (
          topCategories.map((item) => (
            <View style={styles.categoryRow} key={item.category}>
              <View style={styles.categoryMeta}>
                <View style={styles.categoryDot} />
                <Text style={styles.categoryLabel}>{item.category}</Text>
              </View>
              <View style={styles.categoryAmounts}>
                <Text style={styles.categoryValue}>
                  {currencyFormatter.format(item.total)}
                </Text>
                <Text style={styles.categoryPercent}>
                  {percentFormatter.format(item.percent)}
                </Text>
              </View>
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
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  categoryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4c71ff',
  },
  categoryLabel: {
    color: '#e8f0fe',
    fontSize: 16,
  },
  categoryAmounts: {
    alignItems: 'flex-end',
  },
  categoryValue: {
    color: '#e8f0fe',
    fontWeight: '600',
  },
  categoryPercent: {
    color: '#8aa0b6',
    fontSize: 13,
  },
});
