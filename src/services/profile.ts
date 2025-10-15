import firebase from 'firebase/compat/app';
import { db, firebaseAuth } from '@/firebase';

export type UserProfile = {
  monthlyIncome?: number;
  currency?: string;
  updatedAt?: firebase.firestore.Timestamp;
};

export function observeUserProfile(handler: (profile: UserProfile | null) => void) {
  const user = firebaseAuth.currentUser;
  if (!user) {
    handler(null);
    return () => {};
  }

  return db
    .collection('profiles')
    .doc(user.uid)
    .onSnapshot((snapshot) => {
      if (!snapshot.exists) {
        handler(null);
        return;
      }
      handler(snapshot.data() as UserProfile);
    });
}

export async function upsertUserProfile(
  profile: Partial<UserProfile>,
): Promise<void> {
  const user = firebaseAuth.currentUser;
  if (!user) {
    throw new Error('Not signed in');
  }

  await db
    .collection('profiles')
    .doc(user.uid)
    .set(
      {
        ...profile,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}
