import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Switch,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from '@/utils/LinearGradient';

import { firebaseAuth } from '../firebase';
import { listenAuth, signOutUser } from '../services/auth';
import { observeMonthlySummary, MonthlySummary } from '@/services/expenses';
import { observeUserProfile, upsertUserProfile, UserProfile } from '@/services/profile';
import { observeActivity, ActivityEntry } from '@/services/activity';
import { AppButton } from '@/components/ui/AppButton';
import { cardShadow, Palette } from '@/styles/palette';
import { Fonts } from '@/constants/theme';
import { useAppTheme } from '@/styles/ThemeProvider';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SUPPORTED_CURRENCIES } from '@/constants/currencies';

let VictoryPie: any;

try {
  const victoryLib = require('victory-native');
  VictoryPie = victoryLib.VictoryPie;
} catch (error) {
  console.warn('Victory charts unavailable, showing summaries only.', error);
}

const percentFormatter = new Intl.NumberFormat(undefined, {
  style: 'percent',
  maximumFractionDigits: 1,
});

const CATEGORY_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#f97316', '#a855f7', '#14b8a6'];

export default function HomeScreen() {
  const { palette, mode, setMode } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const insets = useSafeAreaInsets();
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
  const [savingIncome, setSavingIncome] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [updatingCurrency, setUpdatingCurrency] = useState(false);
  const currency = profile?.currency ?? 'USD';
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
      }),
    [currency],
  );

  const formattedIncome = useMemo(() => {
    if (!profile?.monthlyIncome) return currencyFormatter.format(0);
    return currencyFormatter.format(profile.monthlyIncome);
  }, [profile?.monthlyIncome, currencyFormatter]);

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

  const statPillGradients = useMemo(
    () =>
      mode === 'light'
        ? [
            ['#7c83ff', '#a855f7'],
            ['#0ea5e9', '#22d3ee'],
            ['#f97316', '#fb7185'],
          ]
        : [
            ['#4c51bf', '#6d28d9'],
            ['#0f766e', '#0d9488'],
            ['#b45309', '#be123c'],
          ],
    [mode],
  );

  const statPillConfigs = useMemo(
    () => [
      {
        key: 'spent',
        label: 'Spent',
        value: currencyFormatter.format(summary.totalSpent),
        hint: 'So far this month',
        colors: statPillGradients[0],
        icon: 'creditcard.fill' as const,
      },
      {
        key: 'remaining',
        label: 'Remaining',
        value: currencyFormatter.format(summary.remainingBudget),
        hint: summary.monthlyIncome > 0 ? 'Left in your budget' : 'Set a monthly income',
        colors: statPillGradients[1],
        icon: 'shield.checkerboard' as const,
      },
      {
        key: 'transactions',
        label: 'Transactions',
        value: summary.transactions.toString(),
        hint: 'Logged this month',
        colors: statPillGradients[2],
        icon: 'chart.bar.fill' as const,
      },
    ],
    [
      summary.totalSpent,
      summary.remainingBudget,
      summary.monthlyIncome,
      summary.transactions,
      statPillGradients,
      currencyFormatter,
    ],
  );

  async function saveIncome() {
    if (savingIncome) return;

    const parsed = Number(incomeDraft);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      Alert.alert('Monthly income', 'Enter a positive number before saving.');
      return;
    }

    try {
      setSavingIncome(true);
      await upsertUserProfile({ monthlyIncome: parsed, currency });
      setEditingIncome(false);
      Alert.alert('Monthly income', 'Income updated successfully.');
    } catch (error: any) {
      Alert.alert('Monthly income', error?.message ?? 'Unable to update income.');
    } finally {
      setSavingIncome(false);
    }
  }

  async function handleCurrencySelect(nextCurrency: string) {
    if (nextCurrency === currency) {
      setShowCurrencyPicker(false);
      return;
    }
    try {
      setUpdatingCurrency(true);
      await upsertUserProfile({ currency: nextCurrency });
      setShowCurrencyPicker(false);
    } catch (error: any) {
      Alert.alert('Currency', error?.message ?? 'Unable to update currency.');
    } finally {
      setUpdatingCurrency(false);
    }
  }

  const spendRatio =
    summary.monthlyIncome > 0 ? Math.min(summary.totalSpent / summary.monthlyIncome, 1) : 0;

  const heroGradient = mode === 'light' ? ['#dfe6ff', '#c7d4ff'] : ['#243357', '#101c33'];
  const introGradient = mode === 'light' ? ['#eef2ff', '#e0e7ff', '#f8fafc'] : ['#0b1430', '#0d1a3f', '#0f172a'];
  const handleThemeToggle = (next: boolean) => {
    void setMode(next ? 'light' : 'dark');
  };
  const hasBudget = summary.monthlyIncome > 0;
  const pacingLabel = !hasBudget
    ? 'Set a budget to unlock insights'
    : spendRatio < 0.35
      ? 'Healthy pace'
      : spendRatio < 0.7
        ? 'Monitor mid-month spend'
        : 'Tighten expenses';
  const heroSubcopy =
    activity.length > 0
      ? 'Your latest logs are keeping PocketPilot fresh.'
      : 'Log an expense to start charting this month.';
  const progressColor =
    spendRatio > 0.85 ? palette.danger : spendRatio > 0.65 ? palette.warning : palette.accent;

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top || 12 }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back</Text>
          <Text style={styles.email}>{email ?? 'Not signed in'}</Text>
        </View>
        <View style={styles.headerActions}>
          <View>
            <Text style={styles.themeToggleLabel}>Display</Text>
            <View style={styles.themeToggle}>
              <IconSymbol name="moon.stars.fill" size={14} color={palette.textSecondary} />
              <Switch
                value={mode === 'light'}
                onValueChange={handleThemeToggle}
                trackColor={{ false: palette.border, true: palette.accent }}
                thumbColor={mode === 'light' ? palette.background : palette.textPrimary}
                ios_backgroundColor={palette.border}
              />
              <IconSymbol name="sun.max.fill" size={14} color={palette.textSecondary} />
            </View>
          </View>
          <TouchableOpacity onPress={signOutUser} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <LinearGradient
        colors={introGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.ribbonCard}>
        <View style={styles.ribbonRow}>
          <View style={styles.ribbonBadge}>
            <Text style={styles.ribbonBadgeText}>PocketPilot</Text>
            <View style={styles.ribbonBadgeDot} />
            <Text style={styles.ribbonBadgeTextMuted}>Live workspace</Text>
          </View>
          <View style={styles.ribbonStatus}>
            <IconSymbol name="shield.checkerboard" size={16} color={palette.accentBright} />
            <Text style={styles.ribbonStatusText}>{pacingLabel}</Text>
          </View>
        </View>
        <Text style={styles.ribbonTitle}>Guide your month with confidence</Text>
        <Text style={styles.ribbonSubtitle}>{heroSubcopy}</Text>
        <View style={styles.ribbonChips}>
          <View style={styles.ribbonChip}>
            <IconSymbol name="chart.bar.fill" size={16} color={palette.accentBright} />
            <View>
              <Text style={styles.ribbonChipLabel}>Spent</Text>
              <Text style={styles.ribbonChipValue}>{currencyFormatter.format(summary.totalSpent)}</Text>
            </View>
          </View>
          <View style={styles.ribbonChip}>
            <IconSymbol name="person.2.fill" size={16} color={palette.accentBright} />
            <View>
              <Text style={styles.ribbonChipLabel}>Activity</Text>
              <Text style={styles.ribbonChipValue}>{activity.length} updates</Text>
            </View>
          </View>
          <View style={styles.ribbonChip}>
            <IconSymbol name="clock.fill" size={16} color={palette.accentBright} />
            <View>
              <Text style={styles.ribbonChipLabel}>Budget</Text>
              <Text style={styles.ribbonChipValue}>
                {hasBudget ? formattedIncome : 'Set your income'}
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.statPills}>
        {statPillConfigs.map((pill) => (
          <LinearGradient
            key={pill.key}
            colors={pill.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.statPill}>
            <View style={styles.statHeader}>
              <View style={styles.statIcon}>
                <IconSymbol name={pill.icon} size={16} color="#ffffff" />
              </View>
              <Text style={styles.statLabel}>{pill.label}</Text>
            </View>
            <Text style={styles.statValue}>{pill.value}</Text>
            <Text style={styles.statHint}>{pill.hint}</Text>
          </LinearGradient>
        ))}
      </View>

      <LinearGradient
        colors={heroGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroChip}>
            <Text style={styles.heroChipText}>Month in focus</Text>
            <View style={styles.heroChipDivider} />
            <Text style={styles.heroChipValue}>
              {summary.transactions} {summary.transactions === 1 ? 'log' : 'logs'}
            </Text>
          </View>
          <View style={styles.heroChipSoft}>
            <IconSymbol name="sparkles" size={14} color={palette.textSecondary} />
            <Text style={styles.heroChipSoftText}>{pacingLabel}</Text>
          </View>
        </View>
        <View style={styles.heroContent}>
          <View>
            <Text style={styles.heroLabel}>Remaining budget</Text>
            <Text style={styles.heroValue}>
              {currencyFormatter.format(summary.remainingBudget)}
            </Text>
          </View>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>
              {percentFormatter.format(spendRatio)} spent
            </Text>
          </View>
        </View>
        <Text style={styles.heroHint}>
          Keep logging expenses to stay on track this month.
        </Text>
      </LinearGradient>

      <View style={[styles.card, styles.calloutCard]}>
        <View style={styles.calloutHeader}>
          <View style={styles.calloutIcon}>
            <IconSymbol name="paperplane.fill" size={16} color={palette.onAccent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.calloutTitle}>Ready for launch</Text>
            <Text style={styles.calloutSubtitle}>
              {pacingLabel} • {summary.transactions} {summary.transactions === 1 ? 'entry' : 'entries'} this month
            </Text>
          </View>
        </View>
        <View style={styles.calloutChips}>
          <View style={styles.calloutChip}>
            <Text style={styles.calloutChipLabel}>Spend</Text>
            <Text style={styles.calloutChipValue}>
              {currencyFormatter.format(summary.totalSpent)}
            </Text>
          </View>
          <View style={styles.calloutChip}>
            <Text style={styles.calloutChipLabel}>Remaining</Text>
            <Text style={styles.calloutChipValue}>
              {currencyFormatter.format(summary.remainingBudget)}
            </Text>
          </View>
          <View style={[styles.calloutChip, styles.calloutChipAccent]}>
            <Text style={styles.calloutChipLabel}>Top focus</Text>
            <Text style={styles.calloutChipValue}>
              {topCategories[0]?.category ?? 'Add a category'}
            </Text>
          </View>
        </View>
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
            <AppButton
              label="Save income"
              onPress={saveIncome}
              loading={savingIncome}
              disabled={savingIncome}
            />
          </>
        ) : (
          <Text style={styles.highlightValue}>{formattedIncome}</Text>
        )}
        <Text style={styles.caption}>Used to calculate your monthly budget.</Text>

        <View style={styles.currencySection}>
          <Text style={styles.currencyLabel}>Display currency</Text>
          <Pressable
            style={styles.currencyDropdown}
            onPress={() => setShowCurrencyPicker((current) => !current)}
            disabled={updatingCurrency}>
            <Text style={styles.currencyValue}>{currency}</Text>
            <Text style={styles.currencyCaret}>{showCurrencyPicker ? '▲' : '▼'}</Text>
          </Pressable>
          {showCurrencyPicker ? (
            <View style={styles.currencyDropdownList}>
              {SUPPORTED_CURRENCIES.map((option) => {
                const selected = option === currency;
                return (
                  <Pressable
                    key={option}
                    style={[styles.currencyOption, selected && styles.currencyOptionSelected]}
                    disabled={updatingCurrency}
                    onPress={() => handleCurrencySelect(option)}>
                    <Text
                      style={[
                        styles.currencyOptionText,
                        selected && styles.currencyOptionTextSelected,
                      ]}>
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          {updatingCurrency ? (
            <Text style={styles.currencyStatus}>Saving currency...</Text>
          ) : null}
        </View>
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
              <View
                style={[
                  styles.progressFill,
                  { width: `${spendRatio * 100}%`, backgroundColor: progressColor },
                ]}
              />
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
                <View style={styles.chartWrapper}>
                  <VictoryPie
                    data={pieData}
                    colorScale={resolvedPieColors}
                    width={260}
                    height={260}
                    animate={{ duration: 500 }}
                    innerRadius={70}
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
                        fill: palette.textPrimary,
                        fontSize: 12,
                        fontWeight: '600',
                        textAlign: 'center',
                      },
                    }}
                  />
                  <View style={styles.chartCenter}>
                    <Text style={styles.chartCenterValue}>
                      {currencyFormatter.format(summary.totalSpent)}
                    </Text>
                    <Text style={styles.chartCenterLabel}>
                      {summary.monthlyIncome > 0
                        ? `of ${currencyFormatter.format(summary.monthlyIncome)} budget`
                        : 'tracked this month'}
                    </Text>
                  </View>
                </View>
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
                  <Text style={styles.activitySubtitle}>
                    {describeActivity(entry, currencyFormatter)}
                  </Text>
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
    </SafeAreaView>
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
    paddingBottom: 64,
    gap: 24,
  },
  ribbonCard: {
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 12,
    ...cardShadow,
  },
  ribbonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    rowGap: 8,
  },
  ribbonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: palette.surfaceElevated,
    borderWidth: 1,
    borderColor: palette.border,
  },
  ribbonBadgeText: {
    color: palette.textPrimary,
    fontWeight: '700',
    letterSpacing: 0.6,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  ribbonBadgeTextMuted: {
    color: palette.textMuted,
    fontWeight: '600',
    fontSize: 12,
  },
  ribbonBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.accent,
  },
  ribbonStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: palette.accentMuted,
  },
  ribbonStatusText: {
    color: palette.textPrimary,
    fontWeight: '600',
    fontSize: 13,
  },
  ribbonTitle: {
    color: palette.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    fontFamily: Fonts.rounded,
    letterSpacing: 0.4,
  },
  ribbonSubtitle: {
    color: palette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  ribbonChips: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  ribbonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: palette.surfaceElevated,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    minWidth: 110,
  },
  ribbonChipLabel: {
    color: palette.textMuted,
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  ribbonChipValue: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    rowGap: 12,
  },
  statPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statPill: {
    flex: 1,
    minWidth: 150,
    borderRadius: 24,
    padding: 18,
    ...cardShadow,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statLabel: {
    color: '#ffffff',
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    opacity: 0.85,
  },
  statValue: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
  },
  statHint: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    flexShrink: 1,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  themeToggleLabel: {
    color: palette.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
  },
  themeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    justifyContent: 'center',
  },
  greeting: {
    color: palette.textSecondary,
    fontSize: 16,
    fontFamily: Fonts.rounded,
    letterSpacing: 0.2,
  },
  email: {
    color: palette.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  logoutButton: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  logoutText: {
    color: palette.textPrimary,
    fontWeight: '600',
  },
  heroCard: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 12,
    ...cardShadow,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
    rowGap: 8,
  },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    minWidth: 0,
    flexShrink: 1,
  },
  heroChipText: {
    color: palette.textSecondary,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  heroChipDivider: {
    width: 8,
    height: 1,
    backgroundColor: palette.border,
  },
  heroChipValue: {
    color: palette.textPrimary,
    fontWeight: '700',
  },
  heroChipSoft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: palette.backgroundAlt,
    borderWidth: 1,
    borderColor: palette.border,
    minWidth: 0,
    flexShrink: 1,
  },
  heroChipSoftText: {
    color: palette.textSecondary,
    fontWeight: '600',
  },
  heroContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroLabel: {
    color: palette.textMuted,
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroValue: {
    color: palette.textPrimary,
    fontSize: 34,
    fontWeight: '700',
  },
  heroBadge: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: palette.accentMuted,
  },
  heroBadgeText: {
    color: palette.accentBright,
    fontWeight: '600',
  },
  heroHint: {
    color: palette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 24,
    gap: 16,
    borderWidth: 1,
    borderColor: palette.border,
    ...cardShadow,
  },
  calloutCard: {
    paddingVertical: 18,
    gap: 12,
  },
  calloutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  calloutIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: palette.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calloutTitle: {
    color: palette.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  calloutSubtitle: {
    color: palette.textSecondary,
    fontSize: 14,
  },
  calloutChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  calloutChip: {
    backgroundColor: palette.surfaceElevated,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: palette.border,
    minWidth: 110,
  },
  calloutChipAccent: {
    borderColor: palette.accent,
    backgroundColor: palette.accentMuted,
  },
  calloutChipLabel: {
    color: palette.textMuted,
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  calloutChipValue: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    color: palette.textPrimary,
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: 0.2,
    fontFamily: Fonts.rounded,
  },
  cardSubtitle: {
    color: palette.textMuted,
    fontSize: 14,
  },
  caption: {
    color: palette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  editLink: {
    color: palette.accentBright,
    fontWeight: '600',
  },
  highlightValue: {
    color: palette.textPrimary,
    fontSize: 32,
    fontWeight: '700',
  },
  input: {
    backgroundColor: palette.backgroundAlt,
    borderRadius: 12,
    padding: 14,
    color: palette.textPrimary,
    borderWidth: 1,
    borderColor: palette.border,
  },
  currencySection: {
    marginTop: 4,
    gap: 8,
  },
  currencyLabel: {
    color: palette.textMuted,
    fontSize: 13,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  currencyDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.backgroundAlt,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  currencyValue: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  currencyCaret: {
    color: palette.textSecondary,
    fontSize: 14,
  },
  currencyDropdownList: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.backgroundAlt,
    borderRadius: 16,
    marginTop: 6,
    overflow: 'hidden',
  },
  currencyOption: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  currencyOptionSelected: {
    backgroundColor: palette.surfaceElevated,
  },
  currencyOptionText: {
    color: palette.textPrimary,
    fontSize: 15,
  },
  currencyOptionTextSelected: {
    fontWeight: '700',
  },
  currencyStatus: {
    color: palette.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 18,
  },
  rowItem: {
    flex: 1,
    gap: 6,
  },
  metricLabel: {
    color: palette.textMuted,
    fontSize: 13,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  metricValue: {
    color: palette.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  progressWrapper: {
    gap: 10,
  },
  progressTrack: {
    backgroundColor: palette.accentMuted,
    height: 12,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: palette.accent,
    height: '100%',
    borderRadius: 999,
  },
  progressCaption: {
    color: palette.textSecondary,
    fontSize: 14,
  },
  categoriesSection: {
    gap: 24,
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: palette.surfaceElevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
  },
  chartWrapper: {
    width: 260,
    height: 260,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  chartCenterValue: {
    color: palette.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  chartCenterLabel: {
    color: palette.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },
  categoryList: {
    gap: 14,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: palette.surfaceElevated,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: palette.border,
  },
  categoryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: palette.accent,
  },
  categoryLabel: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  categoryPercent: {
    color: palette.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  categoryValue: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.surfaceMuted,
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  activityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  activityDotExpense: {
    backgroundColor: palette.danger,
  },
  activityDotGoal: {
    backgroundColor: palette.accent,
  },
  activityTitle: {
    color: palette.textPrimary,
    fontWeight: '600',
  },
  activitySubtitle: {
    color: palette.textSecondary,
    fontSize: 12,
  },
  activityAmount: {
    color: palette.textPrimary,
    fontWeight: '600',
  },
  });

function describeActivity(entry: ActivityEntry, currencyFormatter: Intl.NumberFormat) {
  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  let timestampLabel = 'recently';
  if (entry.createdAt && typeof entry.createdAt.toDate === 'function') {
    try {
      timestampLabel = dateFormatter.format(entry.createdAt.toDate());
    } catch {
      // ignore
    }
  } else if (entry.createdAtISO) {
    try {
      timestampLabel = dateFormatter.format(new Date(entry.createdAtISO));
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
