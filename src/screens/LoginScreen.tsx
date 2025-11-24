import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from '@/utils/LinearGradient';

import { AppButton } from '@/components/ui/AppButton';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { cardShadow, Palette, darkPalette, lightPalette } from '@/styles/palette';
import { Fonts } from '@/constants/theme';
import { signIn, signUp } from '../services/auth';
import { ThemeMode, useAppTheme } from '@/styles/ThemeProvider';

const AUTH_TABS = [
  { id: 'login', label: 'Sign in' },
  { id: 'signup', label: 'Create account' },
] as const;

const HIGHLIGHTS = [
  {
    title: 'Real-time insights',
    description: 'See weekly burn, upcoming bills, and savings momentum in one glance.',
    icon: 'chart.bar.fill' as const,
    accent: '#7c83ff',
  },
  {
    title: 'Secure by design',
    description: 'Your data is encrypted at rest and protected with multi-device sync.',
    icon: 'shield.checkerboard' as const,
    accent: '#34d399',
  },
  {
    title: 'Co-pilot ready',
    description: 'Share trips and expenses with friends without messy spreadsheets.',
    icon: 'person.2.fill' as const,
    accent: '#f97316',
  },
];

const TIPS = ['Syncs on every device', 'Smart reminders', 'Voice-powered commands'];

const SAMPLE_STATS = [
  { label: 'This week logged', value: '$420' },
  { label: 'Goals funded', value: '3' },
  { label: 'On-time streak', value: '12 days' },
];

const SAVED_CRED_KEY = 'pp:last-login';

type LoginThemeConfig = {
  mode: ThemeMode;
  palette: Palette;
  gradient: string[];
  statCardBackground: string;
  statCardBorder: string;
  cardBackground: string;
  cardBorder: string;
  tabChipBorder: string;
  tabChipActiveBorder: string;
  inputBackground: string;
  inputBorder: string;
  tipChipBackground: string;
  highlightChipBackground: string;
  highlightChipBorder: string;
  highlightCardBackground: string;
  highlightCardBorder: string;
  themeToggleBorder: string;
  placeholderTextColor: string;
};

const LOGIN_THEME_CONFIG: Record<ThemeMode, LoginThemeConfig> = {
  dark: {
    mode: 'dark',
    palette: darkPalette,
    gradient: ['#030813', '#111d35'],
    statCardBackground: 'rgba(255,255,255,0.05)',
    statCardBorder: 'rgba(255,255,255,0.08)',
    cardBackground: 'rgba(16,28,51,0.92)',
    cardBorder: 'rgba(124,131,255,0.25)',
    tabChipBorder: 'rgba(255,255,255,0.15)',
    tabChipActiveBorder: 'rgba(255,255,255,0.4)',
    inputBackground: 'rgba(6,11,22,0.9)',
    inputBorder: 'rgba(124,131,255,0.35)',
    tipChipBackground: 'rgba(255,255,255,0.05)',
    highlightChipBackground: 'rgba(255,255,255,0.05)',
    highlightChipBorder: 'rgba(255,255,255,0.08)',
    highlightCardBackground: 'rgba(7,13,26,0.8)',
    highlightCardBorder: 'rgba(124,131,255,0.2)',
    themeToggleBorder: 'rgba(255,255,255,0.18)',
    placeholderTextColor: 'rgba(232,240,254,0.4)',
  },
  light: {
    mode: 'light',
    palette: lightPalette,
    gradient: ['#eff3ff', '#d6e0ff'],
    statCardBackground: 'rgba(15,23,42,0.03)',
    statCardBorder: 'rgba(15,23,42,0.08)',
    cardBackground: '#ffffff',
    cardBorder: 'rgba(15,23,42,0.08)',
    tabChipBorder: 'rgba(15,23,42,0.12)',
    tabChipActiveBorder: 'rgba(99,102,241,0.6)',
    inputBackground: '#ffffff',
    inputBorder: 'rgba(99,102,241,0.4)',
    tipChipBackground: 'rgba(99,102,241,0.08)',
    highlightChipBackground: 'rgba(99,102,241,0.05)',
    highlightChipBorder: 'rgba(99,102,241,0.15)',
    highlightCardBackground: '#f8faff',
    highlightCardBorder: 'rgba(99,102,241,0.2)',
    themeToggleBorder: 'rgba(15,23,42,0.1)',
    placeholderTextColor: 'rgba(15,23,42,0.4)',
  },
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [submitting, setSubmitting] = useState(false);
  const [selectedHighlight, setSelectedHighlight] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [savedUser, setSavedUser] = useState<{ email: string; password: string } | null>(null);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const { mode: themeMode, setMode: setThemeMode } = useAppTheme();

  const theme = LOGIN_THEME_CONFIG[themeMode];
  const themedPalette = theme.palette;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const placeholderColor = theme.placeholderTextColor;

  const title = mode === 'login' ? 'Welcome back' : 'Create your account';
  const subtitle =
    mode === 'login'
      ? 'Pick up where you left off — budgets, timelines, and shared trips stay in sync.'
      : 'Join thousands of travelers tracking every swipe with PocketPilot.';

  const ctaLabel = useMemo(() => (mode === 'login' ? 'Sign in' : 'Start tracking'), [mode]);
  const highlight = HIGHLIGHTS[selectedHighlight];

  const handleSubmit = async () => {
    if (!email.trim() || !pwd.trim()) {
      Alert.alert('Almost there', 'Enter both email and password to continue.');
      return;
    }
    try {
      setSubmitting(true);
      if (mode === 'login') {
        await signIn(email.trim(), pwd);
      } else {
        await signUp(email.trim(), pwd);
      }
      await AsyncStorage.setItem(SAVED_CRED_KEY, JSON.stringify({ email: email.trim(), password: pwd }));
    } catch (error: any) {
      Alert.alert('PocketPilot', error?.message ?? 'Unable to authenticate right now.');
    } finally {
      setSubmitting(false);
    }
  };

  React.useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SAVED_CRED_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.email && parsed?.password) {
            setSavedUser({ email: parsed.email, password: parsed.password });
          }
        }
      } catch {
        // ignore
      } finally {
        setLoadingSaved(false);
      }
    })();
  }, []);

  const handleUseSaved = async () => {
    if (!savedUser || submitting) return;
    setEmail(savedUser.email);
    setPwd(savedUser.password);
    await handleSubmit();
  };

  return (
    <LinearGradient colors={theme.gradient} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.wrapper}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            <View style={styles.themeToggleWrapper}>
              <View>
                <Text style={styles.themeToggleLabel}>Display</Text>
                <Text style={styles.themeToggleCaption}>
                  {themeMode === 'dark' ? 'Dark flight deck' : 'Bright runway'}
                </Text>
              </View>
              <View style={styles.themeToggleSwitch}>
                <IconSymbol
                  name="moon.stars.fill"
                  size={16}
                  color={themedPalette.textSecondary}
                />
                <Switch
                  value={themeMode === 'light'}
                  onValueChange={(next) => void setThemeMode(next ? 'light' : 'dark')}
                  trackColor={{
                    false: theme.themeToggleBorder,
                    true: theme.palette.accent,
                  }}
                  thumbColor={themeMode === 'light' ? themedPalette.background : themedPalette.textPrimary}
                  ios_backgroundColor={theme.themeToggleBorder}
                />
                <IconSymbol name="sun.max.fill" size={16} color={themedPalette.textSecondary} />
              </View>
            </View>

            <View style={styles.brandSection}>
              <View style={styles.brandBadge}>
                <Text style={styles.brandEmoji}>✈️</Text>
                <View>
                  <Text style={styles.brandName}>PocketPilot</Text>
                  <Text style={styles.brandTagline}>Navigate every dollar with ease</Text>
                </View>
              </View>
              <View style={styles.statsRow}>
                {SAMPLE_STATS.map((stat) => (
                  <View key={stat.label} style={styles.statCard}>
                    <Text style={styles.statValue}>{stat.value}</Text>
                    <Text style={styles.statLabel}>{stat.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.tabRow}>
                {AUTH_TABS.map((tab) => {
                  const active = tab.id === mode;
                  return (
                    <TouchableOpacity
                      key={tab.id}
                      style={[styles.tabChip, active && styles.tabChipActive]}
                      onPress={() => setMode(tab.id)}
                      disabled={submitting}>
                      <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {savedUser ? (
                <TouchableOpacity
                  style={styles.savedAccount}
                  onPress={handleUseSaved}
                  disabled={submitting || loadingSaved}>
                  <View>
                    <Text style={styles.savedAccountLabel}>Saved account</Text>
                    <Text style={styles.savedAccountEmail}>{savedUser.email}</Text>
                  </View>
                  <Text style={styles.savedAccountAction}>
                    {submitting ? 'Signing in…' : 'Tap to fill & sign in'}
                  </Text>
                </TouchableOpacity>
              ) : null}
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>

              <View style={styles.form}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={placeholderColor}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                  editable={!submitting}
                />

                <View>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.passwordWrapper}>
                    <TextInput
                      style={[styles.input, styles.passwordInput]}
                      placeholder="Enter at least 6 characters"
                      placeholderTextColor={placeholderColor}
                      secureTextEntry={!showPassword}
                      value={pwd}
                      onChangeText={setPwd}
                      editable={!submitting}
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowPassword((prev) => !prev)}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                      <IconSymbol
                        name={showPassword ? 'eye.fill' : 'eye.slash.fill'}
                        size={18}
                        color={themedPalette.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <AppButton
                  label={ctaLabel}
                  onPress={handleSubmit}
                  loading={submitting}
                  disabled={submitting}
                />
                <Text style={styles.helper}>
                  By continuing you agree to the mission control handbook (aka our terms & privacy).
                </Text>

                <View style={styles.tipsRow}>
                  {TIPS.map((tip) => (
                <View key={tip} style={styles.tipChip}>
                  <IconSymbol name="sparkles" size={14} color={themedPalette.accentBright} />
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.highlightSection}>
              <Text style={styles.highlightHeading}>Why pilots trust us</Text>
              <View style={styles.highlightTabs}>
                {HIGHLIGHTS.map((item, index) => {
                  const active = index === selectedHighlight;
                  return (
                    <TouchableOpacity
                      key={item.title}
                      style={[styles.highlightChip, active && styles.highlightChipActive]}
                      onPress={() => setSelectedHighlight(index)}>
                      <IconSymbol
                        name={item.icon}
                        size={16}
                        color={active ? themedPalette.background : item.accent}
                      />
                      <Text style={[styles.highlightChipText, active && styles.highlightChipTextActive]}>
                        {item.title}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.highlightCard}>
                <View style={[styles.highlightIconWrap, { backgroundColor: `${highlight.accent}26` }]}>
                  <IconSymbol name={highlight.icon} size={28} color={highlight.accent} />
                </View>
                <Text style={styles.highlightTitle}>{highlight.title}</Text>
                <Text style={styles.highlightDescription}>{highlight.description}</Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const createStyles = (theme: LoginThemeConfig) => {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    safeArea: {
      flex: 1,
    },
    wrapper: {
      flex: 1,
    },
    scrollContent: {
      padding: 24,
      paddingBottom: 48,
      gap: 24,
    },
    themeToggleWrapper: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    themeToggleLabel: {
      color: theme.palette.textSecondary,
      fontSize: 14,
      fontWeight: '600',
    },
    themeToggleCaption: {
      color: theme.palette.textMuted,
      fontSize: 12,
      marginTop: 2,
    },
    themeToggleSwitch: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: theme.themeToggleBorder,
    },
    brandSection: {
      gap: 16,
    },
    brandBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    brandEmoji: {
      fontSize: 40,
    },
    brandName: {
      color: theme.palette.textPrimary,
      fontSize: 26,
      fontFamily: Fonts.rounded,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    brandTagline: {
      color: theme.palette.textSecondary,
      fontSize: 14,
    },
    statsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    statCard: {
      flexGrow: 1,
      minWidth: 110,
      backgroundColor: theme.statCardBackground,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.statCardBorder,
    },
    statValue: {
      color: theme.palette.textPrimary,
      fontSize: 18,
      fontWeight: '700',
    },
    statLabel: {
      color: theme.palette.textSecondary,
      fontSize: 12,
      marginTop: 4,
    },
    card: {
      backgroundColor: theme.cardBackground,
      borderRadius: 28,
      padding: 24,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      gap: 16,
      ...cardShadow,
    },
    tabRow: {
      flexDirection: 'row',
      gap: 10,
    },
    tabChip: {
      flex: 1,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.tabChipBorder,
      paddingVertical: 10,
      alignItems: 'center',
    },
    tabChipActive: {
      backgroundColor: theme.palette.accent,
      borderColor: theme.tabChipActiveBorder,
    },
    tabText: {
      color: theme.palette.textSecondary,
      fontWeight: '600',
    },
    tabTextActive: {
      color: theme.palette.onAccent,
    },
    title: {
      color: theme.palette.textPrimary,
      fontSize: 26,
      fontWeight: '700',
      fontFamily: Fonts.rounded,
    },
    subtitle: {
      color: theme.palette.textSecondary,
      fontSize: 15,
      lineHeight: 22,
    },
    form: {
      gap: 14,
    },
    label: {
      color: theme.palette.textMuted,
      fontSize: 13,
      letterSpacing: 0.6,
    },
    input: {
      backgroundColor: theme.inputBackground,
      borderRadius: 16,
      paddingHorizontal: 18,
      paddingVertical: 14,
      color: theme.palette.textPrimary,
      borderWidth: 1,
      borderColor: theme.inputBorder,
    },
    passwordWrapper: {
      position: 'relative',
    },
    passwordInput: {
      paddingRight: 48,
    },
    eyeButton: {
      position: 'absolute',
      right: 14,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
    },
    helper: {
      color: theme.palette.textMuted,
      fontSize: 12,
      lineHeight: 18,
      textAlign: 'center',
    },
    savedAccount: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.tabChipBorder,
      backgroundColor: theme.tipChipBackground,
      padding: 12,
      marginBottom: 4,
    },
    savedAccountLabel: {
      color: theme.palette.textMuted,
      fontSize: 12,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      fontWeight: '700',
    },
    savedAccountEmail: {
      color: theme.palette.textPrimary,
      fontSize: 15,
      fontWeight: '700',
      marginTop: 2,
    },
    savedAccountAction: {
      color: theme.palette.accent,
      fontWeight: '700',
      fontSize: 13,
    },
    tipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      justifyContent: 'center',
    },
    tipChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: theme.tipChipBackground,
    },
    tipText: {
      color: theme.palette.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    highlightSection: {
      gap: 16,
    },
    highlightHeading: {
      color: theme.palette.textPrimary,
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.4,
    },
    highlightTabs: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    highlightChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.highlightChipBorder,
      backgroundColor: theme.highlightChipBackground,
    },
    highlightChipActive: {
      backgroundColor: theme.palette.accent,
      borderColor: theme.palette.accent,
    },
    highlightChipText: {
      color: theme.palette.textSecondary,
      fontWeight: '600',
    },
    highlightChipTextActive: {
      color: theme.palette.onAccent,
    },
    highlightCard: {
      backgroundColor: theme.highlightCardBackground,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.highlightCardBorder,
      gap: 10,
    },
    highlightIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    highlightTitle: {
      color: theme.palette.textPrimary,
      fontSize: 18,
      fontWeight: '700',
    },
    highlightDescription: {
      color: theme.palette.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
  });
};
