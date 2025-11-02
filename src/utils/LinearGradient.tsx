import React from 'react';
import { View, ViewProps } from 'react-native';

type LinearGradientProps = ViewProps & {
  colors?: string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  locations?: number[];
};

const FallbackLinearGradient: React.FC<LinearGradientProps> = ({
  colors: _colors,
  start: _start,
  end: _end,
  locations: _locations,
  style,
  children,
  ...rest
}) => (
  <View style={style} {...rest}>
    {children}
  </View>
);

let LinearGradientComponent: React.ComponentType<LinearGradientProps> = FallbackLinearGradient;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { LinearGradient } = require('expo-linear-gradient');
  if (LinearGradient) {
    LinearGradientComponent = LinearGradient;
  }
} catch (error) {
  if (__DEV__) {
    console.warn('expo-linear-gradient unavailable, using fallback view.', error);
  }
}

export const LinearGradient = LinearGradientComponent;
