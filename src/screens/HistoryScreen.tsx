import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { observeHistoricalSummaries, MonthlySummary } from '@/services/expenses';
import { palette, cardShadow } from '@/styles/palette';
import { LinearGradient } from '@/utils/LinearGradient';

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function formatMonth(dateKey: string) {
  const [year, month] = dateKey.split('-');
  const monthIndex = Number(month) - 1;
  const monthLabel = MONTH_LABELS[monthIndex] ?? month;
  return `${monthLabel} ${year}`;
}

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

export default function HistoryScreen() {
  const [summaries, setSummaries] = useState<Array<{ id: string; summary: MonthlySummary }>>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = observeHistoricalSummaries((history) => {
      setSummaries(history);
      if (!selectedMonth && history.length) {
        setSelectedMonth(history[0]?.id ?? null);
      }
    });

    return unsubscribe;
  }, [selectedMonth]);

  const selectedSummary = useMemo(
    () => summaries.find((item) => item.id === selectedMonth)?.summary ?? null,
    [summaries, selectedMonth],
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Monthly history</Text>

      <View style={styles.timeline}>
        {summaries.length === 0 ? (
          <Text style={styles.placeholder}>No previous months yet. Start logging expenses.</Text>
        ) : (
          summaries.map((item) => {
            const isActive = item.id === selectedMonth;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.timelineEntry, isActive && styles.timelineEntryActive]}
                onPress={() => setSelectedMonth(item.id)}>
                <View style={[styles.timelineDot, isActive && styles.timelineDotActive]} />
                <Text style={[styles.timelineLabel, isActive && styles.timelineLabelActive]}>
                  {formatMonth(item.id)}
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {selectedSummary ? (
        <LinearGradient
          colors={['#243357', '#101c33']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <Text style={styles.detailTitle}>{formatMonth(selectedMonth ?? '')}</Text>
            <Text style={styles.detailSubtitle}>
              {selectedSummary.transactions} {selectedSummary.transactions === 1 ? 'transaction' : 'transactions'}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryMetric}>
              <Text style={styles.summaryLabel}>Total spent</Text>
              <Text style={styles.summaryValue}>{currencyFormatter.format(selectedSummary.totalSpent)}</Text>
            </View>
            <View style={styles.summaryMetric}>
              <Text style={styles.summaryLabel}>Remaining</Text>
              <Text style={styles.summaryValue}>{currencyFormatter.format(selectedSummary.remainingBudget)}</Text>
            </View>
          </View>

          <Text style={styles.sectionHeading}>Categories</Text>
          {selectedSummary.byCategory.length ? (
            <View style={styles.categoryList}>
              {selectedSummary.byCategory.map((category) => (
                <View key={category.category} style={styles.categoryRow}>
                  <Text style={styles.categoryLabel}>{category.category || 'Uncategorized'}</Text>
                  <Text style={styles.categoryAmount}>{currencyFormatter.format(category.total)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.placeholder}>No category data for this month.</Text>
          )}
        </LinearGradient>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    padding: 24,
    paddingBottom: 48,
    gap: 24,
  },
  title: {
    color: palette.textPrimary,
    fontSize: 28,
    fontWeight: '700',
  },
  placeholder: {
    color: palette.textMuted,
    fontSize: 14,
  },
  timeline: {
    backgroundColor: 'rgba(16, 28, 51, 0.92)',
    borderRadius: 24,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(124, 131, 255, 0.12)',
    ...cardShadow,
  },
  timelineEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  timelineEntryActive: {
    backgroundColor: 'rgba(124, 131, 255, 0.15)',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.textMuted,
  },
  timelineDotActive: {
    backgroundColor: palette.accent,
  },
  timelineLabel: {
    color: palette.textSecondary,
    fontSize: 15,
  },
  timelineLabelActive: {
    color: palette.textPrimary,
    fontWeight: '600',
  },
  detailCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(124, 131, 255, 0.25)',
    padding: 24,
    gap: 18,
    ...cardShadow,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailTitle: {
    color: palette.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  detailSubtitle: {
    color: palette.textSecondary,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  summaryMetric: {
    flex: 1,
    backgroundColor: 'rgba(16, 28, 51, 0.92)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(124, 131, 255, 0.12)',
    gap: 8,
  },
  summaryLabel: {
    color: palette.textMuted,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  summaryValue: {
    color: palette.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  sectionHeading: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  categoryList: {
    gap: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 28, 51, 0.85)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(124, 131, 255, 0.08)',
  },
  categoryLabel: {
    color: palette.textPrimary,
    fontWeight: '600',
  },
  categoryAmount: {
    color: palette.textPrimary,
    fontWeight: '700',
  },
});
