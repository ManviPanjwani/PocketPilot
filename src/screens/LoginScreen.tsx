import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { signIn, signUp } from '../services/auth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  const go = async () => {
    try {
      if (mode === 'login') await signIn(email, pwd);
      else await signUp(email, pwd);
    } catch (e: any) {
      Alert.alert('Auth error', e.message ?? String(e));
    }
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>PocketPilot ✈️</Text>
      <TextInput style={s.input} placeholder="Email" autoCapitalize="none" onChangeText={setEmail} value={email}/>
      <TextInput style={s.input} placeholder="Password" secureTextEntry onChangeText={setPwd} value={pwd}/>
      <Button title={mode === 'login' ? 'Login' : 'Create account'} onPress={go}/>
      <View style={{height:12}}/>
      <Button
        title={mode === 'login' ? 'Switch to Sign Up' : 'Switch to Login'}
        onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0f14', padding: 20, justifyContent: 'center' },
  title: { color: '#7c9cff', fontSize: 26, fontWeight: '700', textAlign: 'center', marginBottom: 24 },
  input: { backgroundColor: '#111822', color: '#fff', padding: 12, borderRadius: 8, marginVertical: 8 },
});
