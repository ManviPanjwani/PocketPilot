import 'react-native-gesture-handler';
import 'react-native-reanimated';
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'react-native';

import HomeScreen from '../src/screens/HomeScreen';
import LoginScreen from '../src/screens/LoginScreen';
import { listenAuth } from '../src/services/auth';
import { firebaseAuth } from '../src/firebase'; // this automatically picks native or web
import AddExpense from '../src/screens/AddExpense';
import TransactionsScreen from '../src/screens/TransactionsScreen';


const Tab = createBottomTabNavigator();

export default function App() {
  const [authed, setAuthed] = useState(!!firebaseAuth.currentUser);

  useEffect(() => {
    const unsub = listenAuth((user) => setAuthed(!!user));
    return unsub;
  }, []);

  return (
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
  );
}
