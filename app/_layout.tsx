import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import LoginScreen from '@/src/screens/LoginScreen';
import { listenAuth } from '@/src/services/auth';
import { firebaseAuth } from '@/src/firebase';
import { AssistantProvider } from '@/assistant/AssistantContext';
import { AssistantOverlay } from '@/components/assistant/AssistantOverlay';
import { AssistantFab } from '@/components/assistant/AssistantFab';
import { ThemeProvider as AppThemeProvider } from '@/styles/ThemeProvider';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [checkingAuth, setCheckingAuth] = useState(!firebaseAuth.currentUser);
  const [authed, setAuthed] = useState(() => !!firebaseAuth.currentUser);

  useEffect(() => {
    const unsubscribe = listenAuth((user) => {
      setAuthed(!!user);
      setCheckingAuth(false);
    });

    return unsubscribe;
  }, []);

  const theme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const backgroundStyle = {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  } as const;

  if (checkingAuth) {
    return (
      <AppThemeProvider>
        <NavigationThemeProvider value={theme}>
          <StatusBar style="auto" />
          <View style={backgroundStyle}>
            <ActivityIndicator size="large" />
          </View>
        </NavigationThemeProvider>
      </AppThemeProvider>
    );
  }

  return (
    <AppThemeProvider>
      <AssistantProvider enabled={authed}>
        <NavigationThemeProvider value={theme}>
          {authed ? (
            <>
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
              </Stack>
              <StatusBar style="auto" />
            </>
          ) : (
            <>
              <StatusBar style="light" />
              <LoginScreen />
            </>
          )}
          <AssistantOverlay />
          <AssistantFab />
        </NavigationThemeProvider>
      </AssistantProvider>
    </AppThemeProvider>
  );
}
