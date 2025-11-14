import React, {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Palette, darkPalette, lightPalette } from '@/styles/palette';

export type ThemeMode = 'dark' | 'light';

type ThemeContextValue = {
  mode: ThemeMode;
  palette: Palette;
  setMode: (mode: ThemeMode) => Promise<void>;
  toggleMode: () => void;
  isReady: boolean;
};

const THEME_KEY = 'pocketpilot:theme';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: PropsWithChildren) {
  const [mode, setModeState] = useState<ThemeMode>('dark');
  const [isReady, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(THEME_KEY)
      .then((stored) => {
        if (!mounted) return;
        if (stored === 'dark' || stored === 'light') {
          setModeState(stored);
        }
      })
      .finally(() => {
        if (mounted) {
          setReady(true);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const persistMode = useCallback(async (nextMode: ThemeMode) => {
    setModeState(nextMode);
    try {
      await AsyncStorage.setItem(THEME_KEY, nextMode);
    } catch (error) {
      console.warn('ThemeProvider: failed to persist theme mode', error);
    }
  }, []);

  const toggleMode = useCallback(() => {
    persistMode(mode === 'light' ? 'dark' : 'light');
  }, [mode, persistMode]);

  const palette = mode === 'light' ? lightPalette : darkPalette;

  const value = useMemo(
    () => ({
      mode,
      palette,
      setMode: persistMode,
      toggleMode,
      isReady,
    }),
    [mode, palette, persistMode, toggleMode, isReady],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useAppTheme must be used within ThemeProvider');
  }
  return ctx;
}
