import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from '@/utils/LinearGradient';

import { AppButton } from '@/components/ui/AppButton';
import { cardShadow, palette } from '@/styles/palette';
import { Fonts } from '@/constants/theme';
import { signIn, signUp } from '../services/auth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [submitting, setSubmitting] = useState(false);

  const title = mode === 'login' ? 'Welcome back' : 'Create your account';
  const subtitle = mode === 'login'
    ? 'Track your spending and goals without losing your place.'
    : 'Sign up in seconds to start logging expenses with PocketPilot.';

  const ctaLabel = useMemo(() => (mode === 'login' ? 'Sign in' : 'Create account'), [mode]);

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
    <LinearGradient colors={['#050b18', '#101b32']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.wrapper}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.brandBadge}>
            <Text style={styles.brandEmoji}>✈️</Text>
            <View>
              <Text style={styles.brandName}>PocketPilot</Text>
              <Text style={styles.brandTagline}>Guiding your money mission</Text>
            </View>
          </View>
          <View style={styles.card}>
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
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter at least 6 characters"
                placeholderTextColor="rgba(232,240,254,0.4)"
                secureTextEntry
                value={pwd}
                onChangeText={setPwd}
                editable={!submitting}
              />
              <AppButton
                label={ctaLabel}
                onPress={handleSubmit}
                loading={submitting}
                disabled={submitting}
              />
              <TouchableOpacity
                style={styles.switch}
                onPress={() => setMode((prev) => (prev === 'login' ? 'signup' : 'login'))}
                disabled={submitting}>
                <Text style={styles.switchText}>
                  {mode === 'login'
                    ? 'Need an account? Create one for free.'
                    : 'Already registered? Sign in here.'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
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
    padding: 24,
    justifyContent: 'center',
    gap: 24,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    alignSelf: 'center',
  },
  brandEmoji: {
    fontSize: 36,
  },
  brandName: {
    color: palette.textPrimary,
    fontSize: 22,
    fontFamily: Fonts.rounded,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  brandTagline: {
    color: palette.textSecondary,
    fontSize: 13,
  },
  card: {
    backgroundColor: 'rgba(16,28,51,0.9)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(124,131,255,0.25)',
    gap: 12,
    ...cardShadow,
  },
  title: {
    color: palette.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    fontFamily: Fonts.rounded,
  },
  subtitle: {
    color: palette.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  form: {
    marginTop: 12,
    gap: 10,
  },
  label: {
    color: palette.textMuted,
    fontSize: 13,
    letterSpacing: 0.6,
  },
  input: {
    backgroundColor: 'rgba(6,11,22,0.85)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: palette.textPrimary,
    borderWidth: 1,
    borderColor: 'rgba(124,131,255,0.25)',
  },
  switch: {
    marginTop: 8,
    paddingVertical: 4,
  },
  switchText: {
    color: palette.accentBright,
    textAlign: 'center',
    fontWeight: '600',
  },
});
