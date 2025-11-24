import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { observeHistoricalSummaries, MonthlySummary } from '@/services/expenses';
import { cardShadow, Palette } from '@/styles/palette';
import { LinearGradient } from '@/utils/LinearGradient';
import { useAppTheme } from '@/styles/ThemeProvider';
import { IconSymbol } from '@/components/ui/icon-symbol';

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
  const { palette, mode } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
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

  const aggregate = useMemo(() => {
    if (!summaries.length) return { average: 0, total: 0, bestLabel: '—' };
    const total = summaries.reduce((sum, item) => sum + item.summary.totalSpent, 0);
    const average = total / summaries.length;
    const best = summaries.reduce((prev, current) =>
      current.summary.remainingBudget > prev.summary.remainingBudget ? current : prev,
    );
    return { average, total, bestLabel: formatMonth(best.id) };
  }, [summaries]);

  const detailGradient = mode === 'light' ? ['#e1e7ff', '#cbd5ff'] : ['#243357', '#101c33'];
  const heroGradient = mode === 'light' ? ['#eef2ff', '#e0e7ff'] : ['#0b1430', '#0d1a3f'];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Monthly history</Text>

      <LinearGradient
        colors={heroGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View>
            <Text style={styles.heroEyebrow}>Trendline</Text>
            <Text style={styles.heroTitle}>Look back to plan ahead</Text>
            <Text style={styles.heroSubtitle}>
              {summaries.length
                ? 'Tap a month to compare spend and remaining budget.'
                : 'History is empty. Start logging to build your timeline.'}
            </Text>
          </View>
          <View style={styles.heroBadge}>
            <IconSymbol name="sparkles" size={14} color={palette.accent} />
            <Text style={styles.heroBadgeText}>{summaries.length} month(s)</Text>
          </View>
        </View>

        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Average spend</Text>
            <Text style={styles.heroStatValue}>{currencyFormatter.format(aggregate.average)}</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Lifetime tracked</Text>
            <Text style={styles.heroStatValue}>{currencyFormatter.format(aggregate.total)}</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Best cushion</Text>
            <Text style={styles.heroStatValue}>{aggregate.bestLabel}</Text>
          </View>
        </View>
      </LinearGradient>

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
          colors={detailGradient}
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

const createStyles = (palette: Palette) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    padding: 24,
    paddingBottom: 48,
    gap: 24,
  },
  heroCard: {
    borderRadius: 24,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: palette.border,
    ...cardShadow,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroEyebrow: {
    color: palette.textMuted,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: palette.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  heroSubtitle: {
    color: palette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  heroBadgeText: {
    color: palette.textPrimary,
    fontWeight: '700',
  },
  heroStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  heroStat: {
    flex: 1,
    minWidth: 120,
    backgroundColor: palette.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: palette.border,
  },
  heroStatLabel: {
    color: palette.textMuted,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  heroStatValue: {
    color: palette.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
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
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: palette.border,
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
    backgroundColor: palette.accentMuted,
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
    borderColor: palette.border,
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
    backgroundColor: palette.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
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
    backgroundColor: palette.surfaceElevated,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: palette.border,
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
