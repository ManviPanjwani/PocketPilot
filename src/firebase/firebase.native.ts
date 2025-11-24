import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ⬇️ paste your real config from Firebase console
const firebaseConfig = {
  apiKey: "AIzaSyACmx6h4RXadcFYNfEOCavmQQIurCF0C4w",
  authDomain: "pocketpilot-1997d.firebaseapp.com",
  projectId: "pocketpilot-1997d",
  storageBucket: "pocketpilot-1997d.firebasestorage.app",
  messagingSenderId: "862874026235",
  appId: "1:862874026235:web:1d3e81c6fe68e410d3705e",
  measurementId: "G-40B310YZNG"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const app = firebase.app();
const firebaseAuth = firebase.auth();
const reactNativePersistence = {
  type: 'LOCAL' as const,
  async setItem(key: string, value: string) {
    await AsyncStorage.setItem(key, value);
  },
  async getItem(key: string) {
    return AsyncStorage.getItem(key);
  },
  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
  },
};

// Ensure auth persists across app restarts using AsyncStorage.
firebaseAuth
  .setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .catch(async () => {
    await firebaseAuth.setPersistence(reactNativePersistence as unknown as firebase.auth.Auth.Persistence);
  })
  .catch(() => {
    // ignore if persistence cannot be set; auth will fallback to memory
  });
const db = firebase.firestore();
const storage = firebase.storage();

export { firebase, app, firebaseAuth, db, storage };
