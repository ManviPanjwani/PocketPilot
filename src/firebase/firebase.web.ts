import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';

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
const db = firebase.firestore();
const storage = firebase.storage();

export { firebase, app, firebaseAuth, db, storage };
