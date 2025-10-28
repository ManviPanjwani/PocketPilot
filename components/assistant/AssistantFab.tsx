import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { useAssistant } from '@/assistant/AssistantContext';
import { palette, cardShadow } from '@/styles/palette';
import { IconSymbol } from '@/components/ui/icon-symbol';

export function AssistantFab() {
  const { openAssistant, enabled, isOpen } = useAssistant();

  if (isOpen) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View pointerEvents="box-none" style={styles.container}>
        <TouchableOpacity
          style={[styles.fab, !enabled && styles.fabDisabled]}
          onPress={openAssistant}
          activeOpacity={0.9}>
          <IconSymbol name="sparkles" color={palette.background} size={22} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 28,
    right: 20,
    zIndex: 999,
  },
  fab: {
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: palette.border,
    ...cardShadow,
  },
  fabDisabled: {
    backgroundColor: 'rgba(124, 131, 255, 0.55)',
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
});
