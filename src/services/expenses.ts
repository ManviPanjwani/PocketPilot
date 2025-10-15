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

export type MonthlySummary = {
  totalSpent: number;
  remainingBudget: number;
  monthlyIncome: number;
  transactions: number;
  byCategory: Array<{ category: string; total: number }>;
};

export function observeMonthlySummary(
  monthlyIncome: number,
  handler: (summary: MonthlySummary) => void,
) {
  const user = firebaseAuth.currentUser;
  if (!user) {
    handler({
      totalSpent: 0,
      remainingBudget: monthlyIncome,
      monthlyIncome,
      transactions: 0,
      byCategory: [],
    });
    return () => {};
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const start = firebase.firestore.Timestamp.fromDate(startOfMonth);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const end = firebase.firestore.Timestamp.fromDate(startOfNextMonth);

  return db
    .collection('expenses')
    .where('userId', '==', user.uid)
    .where('createdAt', '>=', start)
    .where('createdAt', '<', end)
    .orderBy('createdAt', 'desc')
    .onSnapshot((snapshot) => {
      let total = 0;
      const categoryTotals = new Map<string, number>();

      snapshot.forEach((doc) => {
        const data = doc.data() as Expense;
        const amount = Number(data.amount) || 0;
        total += amount;

        const key = data.category || 'Uncategorized';
        categoryTotals.set(key, (categoryTotals.get(key) || 0) + amount);
      });

      handler({
        totalSpent: total,
        remainingBudget: Math.max(monthlyIncome - total, 0),
        monthlyIncome,
        transactions: snapshot.size,
        byCategory: Array.from(categoryTotals.entries()).map(([category, total]) => ({
          category,
          total,
        })),
      });
    });
}
