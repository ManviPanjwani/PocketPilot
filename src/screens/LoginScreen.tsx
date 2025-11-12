import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from '@/utils/LinearGradient';

import { AppButton } from '@/components/ui/AppButton';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { cardShadow, palette } from '@/styles/palette';
import { Fonts } from '@/constants/theme';
import { signIn, signUp } from '../services/auth';

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

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [submitting, setSubmitting] = useState(false);
  const [selectedHighlight, setSelectedHighlight] = useState(0);
  const [showPassword, setShowPassword] = useState(false);

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
    } catch (error: any) {
      Alert.alert('PocketPilot', error?.message ?? 'Unable to authenticate right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LinearGradient colors={['#030813', '#111d35']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.wrapper}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
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
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>

              <View style={styles.form}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor="rgba(232,240,254,0.4)"
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
                      placeholderTextColor="rgba(232,240,254,0.4)"
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
                        color={palette.textSecondary}
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
                      <IconSymbol name="sparkles" size={14} color={palette.accentBright} />
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
                        color={active ? palette.background : item.accent}
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

const styles = StyleSheet.create({
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
    color: palette.textPrimary,
    fontSize: 26,
    fontFamily: Fonts.rounded,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  brandTagline: {
    color: palette.textSecondary,
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
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statValue: {
    color: palette.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    color: palette.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  card: {
    backgroundColor: 'rgba(16,28,51,0.92)',
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(124,131,255,0.25)',
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
    borderColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabChipActive: {
    backgroundColor: palette.accent,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  tabText: {
    color: palette.textSecondary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: palette.background,
  },
  title: {
    color: palette.textPrimary,
    fontSize: 26,
    fontWeight: '700',
    fontFamily: Fonts.rounded,
  },
  subtitle: {
    color: palette.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  form: {
    gap: 14,
  },
  label: {
    color: palette.textMuted,
    fontSize: 13,
    letterSpacing: 0.6,
  },
  input: {
    backgroundColor: 'rgba(6,11,22,0.9)',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    color: palette.textPrimary,
    borderWidth: 1,
    borderColor: 'rgba(124,131,255,0.35)',
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
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
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
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  tipText: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  highlightSection: {
    gap: 16,
  },
  highlightHeading: {
    color: palette.textPrimary,
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
    borderColor: 'rgba(255,255,255,0.12)',
  },
  highlightChipActive: {
    backgroundColor: palette.textPrimary,
    borderColor: palette.textPrimary,
  },
  highlightChipText: {
    color: palette.textSecondary,
    fontWeight: '600',
  },
  highlightChipTextActive: {
    color: palette.background,
  },
  highlightCard: {
    backgroundColor: 'rgba(16,28,51,0.95)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(124,131,255,0.25)',
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
    color: palette.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  highlightDescription: {
    color: palette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
});
