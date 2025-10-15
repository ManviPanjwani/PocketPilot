import type firebase from 'firebase/compat/app';
import { firebaseAuth } from '../firebase';

export function listenAuth(cb: (user: firebase.User | null) => void) {
  return firebaseAuth.onAuthStateChanged(cb);
}
export async function signUp(email: string, password: string) {
  return (await firebaseAuth.createUserWithEmailAndPassword(email, password)).user;
}
export async function signIn(email: string, password: string) {
  return (await firebaseAuth.signInWithEmailAndPassword(email, password)).user;
}
export async function signOutUser() {
  await firebaseAuth.signOut();
}
