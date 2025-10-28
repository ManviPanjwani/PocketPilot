import React from 'react';
import {
  ActivityIndicator,
  GestureResponderEvent,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';

import { palette } from '@/styles/palette';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

type Props = {
  label: string;
  onPress: (event: GestureResponderEvent) => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle,
}: Props) {
  const isDisabled = disabled || loading;
  const indicatorColor = variant === 'primary' || variant === 'danger' ? palette.background : palette.textPrimary;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.8}
      disabled={isDisabled}
      style={[styles.base, styles[variant], isDisabled && styles.disabled, style]}
      onPress={onPress}>
      {loading ? <ActivityIndicator color={indicatorColor} size="small" style={styles.spinner} /> : null}
      <Text style={[styles.label, styles[`${variant}Label` as const], textStyle]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primary: {
    backgroundColor: palette.accent,
  },
  primaryLabel: {
    color: palette.background,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: palette.border,
  },
  secondaryLabel: {
    color: palette.textPrimary,
  },
  danger: {
    backgroundColor: palette.danger,
  },
  dangerLabel: {
    color: palette.background,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  disabled: {
    opacity: 0.6,
  },
  spinner: {
    marginRight: 6,
  },
});
