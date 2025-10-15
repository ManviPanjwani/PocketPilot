import { addDoc, collection, getDocs, orderBy, query, serverTimestamp, where, limit } from 'firebase/firestore';
import { db } from '@/firebase';
import { firebaseAuth } from '@/firebase';

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
  const doc = await addDoc(collection(db, 'expenses'), {
    ...input,
    userId: user.uid,
    createdAt: serverTimestamp(),
  });
  return doc.id;
}

export async function fetchRecentExpenses(max = 20): Promise<Expense[]> {
  const user = firebaseAuth.currentUser;
  if (!user) return [];
  const q = query(
    collection(db, 'expenses'),
    where('userId', '==', user.uid),
    orderBy('createdAt', 'desc'),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Expense) }));
}
