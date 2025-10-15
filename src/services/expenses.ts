import firebase from 'firebase/compat/app';
import { db, firebaseAuth } from '@/firebase';

export type Expense = {
  id?: string;
  userId: string;
  amount: number;
  category?: string;
  note?: string;
  createdAt?: any; // Firestore Timestamp
};

export async function addExpense(input: Omit<Expense, 'id' | 'userId' | 'createdAt'>) {
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('Not signed in');
  const payload: Record<string, unknown> = {
    userId: user.uid,
    amount: input.amount,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  if (input.category) {
    payload.category = input.category;
  }

  if (input.note) {
    payload.note = input.note;
  }

  const docRef = await db.collection('expenses').add(payload);
  return docRef.id;
}

export async function fetchRecentExpenses(max = 20): Promise<Expense[]> {
  const user = firebaseAuth.currentUser;
  if (!user) return [];
  const snapshot = await db
    .collection('expenses')
    .where('userId', '==', user.uid)
    .orderBy('createdAt', 'desc')
    .limit(max)
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Expense) }));
}

export function observeRecentExpenses(max = 20, handler: (items: Expense[]) => void) {
  const user = firebaseAuth.currentUser;
  if (!user) {
    handler([]);
    return () => {};
  }

  return db
    .collection('expenses')
    .where('userId', '==', user.uid)
    .orderBy('createdAt', 'desc')
    .limit(max)
    .onSnapshot((snapshot) => {
      handler(snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Expense) })));
    });
}
