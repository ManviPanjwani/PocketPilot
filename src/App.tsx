import 'react-native-gesture-handler';
import 'react-native-reanimated';
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar, View } from 'react-native';

import HomeScreen from '@/screens/HomeScreen';
import LoginScreen from '@/screens/LoginScreen';
import { listenAuth } from '@/services/auth';
import { firebaseAuth } from '@/firebase';
import AddExpense from '@/screens/AddExpense';
import TransactionsScreen from '@/screens/TransactionsScreen';
import { AssistantProvider } from '@/assistant/AssistantContext';
import { AssistantOverlay } from '@/components/assistant/AssistantOverlay';
import { AssistantFab } from '@/components/assistant/AssistantFab';
import { ThemeProvider, useAppTheme } from '@/styles/ThemeProvider';

const Tab = createBottomTabNavigator();

function AppShell() {
  const [authed, setAuthed] = useState(!!firebaseAuth.currentUser);
  const { palette, mode, isReady } = useAppTheme();

  useEffect(() => {
    const unsub = listenAuth((user) => setAuthed(!!user));
    return unsub;
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <AssistantProvider enabled={authed}>
      <View style={{ flex: 1, backgroundColor: palette.background }}>
        <NavigationContainer>
          <StatusBar barStyle={mode === 'light' ? 'dark-content' : 'light-content'} />
          {authed ? (
            <Tab.Navigator screenOptions={{ headerShown: false }}>
              <Tab.Screen name="Home" component={HomeScreen} />
              <Tab.Screen name="Add" component={AddExpense} />
              <Tab.Screen name="Transactions" component={TransactionsScreen} />
            </Tab.Navigator>
          ) : (
            <LoginScreen />
          )}
        </NavigationContainer>
        <AssistantOverlay />
        <AssistantFab />
      </View>
    </AssistantProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}
