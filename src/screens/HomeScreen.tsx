import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { firebaseAuth } from '../firebase';
import { listenAuth, signOutUser } from '../services/auth';

export default function HomeScreen() {
  const [email, setEmail] = useState<string | null>(firebaseAuth.currentUser?.email ?? null);

  useEffect(() => {
    const unsub = listenAuth(u => setEmail(u?.email ?? null));
    return unsub;
  }, []);

  return (
    <View style={s.container}>
      <Text style={s.title}>Home</Text>
      <Text style={s.text}>{email ? `Signed in as ${email}` : 'Not signed in'}</Text>
      {email ? <Button title="Logout" onPress={signOutUser}/> : null}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex:1, backgroundColor:'#0b0f14', padding:20, justifyContent:'center', alignItems:'center' },
  title: { color:'#7c9cff', fontSize:24, fontWeight:'700', marginBottom:12 },
  text: { color:'#e8f0fe' },
});
