import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import LoginScreen from '@/src/screens/LoginScreen';
import { listenAuth } from '@/src/services/auth';
import { firebaseAuth } from '@/src/firebase';

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
      <ThemeProvider value={theme}>
        <StatusBar style="auto" />
        <View style={backgroundStyle}>
          <ActivityIndicator size="large" />
        </View>
      </ThemeProvider>
    );
  }

  if (!authed) {
    return (
      <ThemeProvider value={theme}>
        <StatusBar style="light" />
        <LoginScreen />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider value={theme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
