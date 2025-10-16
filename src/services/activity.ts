import firebase from 'firebase/compat/app';
import { db, firebaseAuth } from '@/firebase';

export type ActivityType = 'expense' | 'goal';

export type ActivityEntry = {
  id?: string;
  userId: string;
  type: ActivityType;
  referenceId: string;
  title: string;
  amount: number;
  snapshot?: Record<string, unknown>;
  createdAt?: firebase.firestore.Timestamp;
  createdAtISO?: string;
};

export async function logActivity(entry: Omit<ActivityEntry, 'id' | 'createdAt' | 'createdAtISO'>) {
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('Not signed in');

  await db.collection('activity').add({
    ...entry,
    userId: user.uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdAtISO: new Date().toISOString(),
  });
}

export function observeActivity(limitCount: number, handler: (items: ActivityEntry[]) => void) {
  const user = firebaseAuth.currentUser;
  if (!user) {
    handler([]);
    return () => {};
  }

  return db
    .collection('activity')
    .where('userId', '==', user.uid)
    .orderBy('createdAt', 'desc')
    .limit(limitCount)
    .onSnapshot((snapshot) => {
      handler(snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as ActivityEntry) })));
    });
}
