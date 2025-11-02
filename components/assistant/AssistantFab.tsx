import React from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

import { LinearGradient } from '@/utils/LinearGradient';

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
        <TouchableOpacity onPress={openAssistant} activeOpacity={0.9} disabled={!enabled}>
          <LinearGradient
            colors={enabled ? ['#7c83ff', '#5666ff'] : ['rgba(124, 131, 255, 0.55)', 'rgba(124, 131, 255, 0.45)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fab}>
            <IconSymbol
              name="sparkles"
              color={enabled ? palette.background : 'rgba(12,18,30,0.85)'}
              size={22}
            />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.select({ ios: 96, android: 96, default: 28 }),
    right: 20,
    zIndex: 999,
  },
  fab: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    ...cardShadow,
  },
});
