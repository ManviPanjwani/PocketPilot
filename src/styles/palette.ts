export const darkPalette = {
  background: '#040b18',
  backgroundAlt: '#071224',
  surface: '#101c33',
  surfaceElevated: '#14223b',
  surfaceMuted: 'rgba(255, 255, 255, 0.04)',
  border: 'rgba(115, 154, 197, 0.18)',
  textPrimary: '#e9f1ff',
  textSecondary: '#9fb4d6',
  textMuted: '#6f7f9a',
  accent: '#7c83ff',
  accentBright: '#9ca2ff',
  accentMuted: 'rgba(124, 131, 255, 0.14)',
  success: '#2dd4bf',
  warning: '#f97316',
  danger: '#f87171',
  onAccent: '#040b18',
};

export type Palette = typeof darkPalette;

export const lightPalette: Palette = {
  background: '#f7f9ff',
  backgroundAlt: '#ffffff',
  surface: '#eff3ff',
  surfaceElevated: '#ffffff',
  surfaceMuted: 'rgba(15, 23, 42, 0.08)',
  border: 'rgba(15, 23, 42, 0.12)',
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#64748b',
  accent: '#7c83ff',
  accentBright: '#6366f1',
  accentMuted: 'rgba(99, 102, 241, 0.1)',
  success: '#2dd4bf',
  warning: '#f97316',
  danger: '#f87171',
  onAccent: '#ffffff',
};

// Temporary backwards-compat export for files not yet migrated to ThemeProvider.
export const palette = darkPalette;

export const cardShadow = {
  shadowColor: '#000',
  shadowOpacity: 0.25,
  shadowOffset: { width: 0, height: 16 },
  shadowRadius: 32,
  elevation: 12,
};
