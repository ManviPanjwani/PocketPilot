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


const Tab = createBottomTabNavigator();

export default function App() {
  const [authed, setAuthed] = useState(!!firebaseAuth.currentUser);

  useEffect(() => {
    const unsub = listenAuth((user) => setAuthed(!!user));
    return unsub;
  }, []);

  return (
    <AssistantProvider enabled={authed}>
      <View style={{ flex: 1 }}>
        <NavigationContainer>
          <StatusBar barStyle="light-content" />
          {authed ? (
            <Tab.Navigator screenOptions={{ headerShown: false }}>
              <Tab.Screen name="Home" component={HomeScreen} />
              <Tab.Screen name="Add" component={AddExpense} />
              <Tab.Screen name="Transactions" component={TransactionsScreen} />
              {/* Add more tabs later: Add, Goals, Transactions */}
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
