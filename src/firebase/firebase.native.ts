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
// Ensure auth persists across app restarts using AsyncStorage (works on native).
// Firebase expects a persistence adapter with setItem/getItem/removeItem; build it defensively.
const nativePersistence =
  AsyncStorage && typeof AsyncStorage.setItem === 'function'
    ? ({
        type: 'LOCAL',
        setItem: AsyncStorage.setItem,
        getItem: AsyncStorage.getItem,
        removeItem: AsyncStorage.removeItem,
      } as const)
    : null;

firebaseAuth
  .setPersistence(
    (nativePersistence ?? firebase.auth.Auth.Persistence.LOCAL) as unknown as firebase.auth.Auth.Persistence,
  )
  .catch(() => {
    // ignore if persistence cannot be set; auth will fallback to memory
  });
const db = firebase.firestore();
const storage = firebase.storage();

export { firebase, app, firebaseAuth, db, storage };
