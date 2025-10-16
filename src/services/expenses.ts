import firebase from 'firebase/compat/app';
import { db, firebaseAuth } from '@/firebase';
import { logActivity } from '@/services/activity';

export type Expense = {
  id?: string;
  userId: string;
  amount: number;
  category?: string;
  note?: string;
  createdAt?: any; // Firestore Timestamp
  createdAtISO?: string;
};

export async function addExpense(input: Omit<Expense, 'id' | 'userId' | 'createdAt'>) {
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('Not signed in');
  const payload: Record<string, unknown> = {
    userId: user.uid,
    amount: input.amount,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdAtISO: new Date().toISOString(),
  };

  if (input.category) {
    payload.category = input.category;
  }

  if (input.note) {
    payload.note = input.note;
  }

  const docRef = await db.collection('expenses').add(payload);

  try {
    await logActivity({
      type: 'expense',
      referenceId: docRef.id,
      title: input.note || input.category || 'Expense',
      amount: input.amount,
      snapshot: {
        category: input.category || null,
        note: input.note || null,
      },
    });
  } catch (err) {
    console.warn('Failed to log activity', err);
  }

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

export async function updateExpense(
  id: string,
  updates: Partial<Omit<Expense, 'id' | 'userId' | 'createdAt' | 'createdAtISO'>>,
) {
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('Not signed in');

  const payload: Record<string, unknown> = {
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  if (typeof updates.amount === 'number') {
    payload.amount = updates.amount;
  }

  if (updates.category !== undefined) {
    payload.category = updates.category || null;
  }

  if (updates.note !== undefined) {
    payload.note = updates.note || null;
  }

  await db.collection('expenses').doc(id).update(payload);
}

export async function deleteExpense(id: string) {
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('Not signed in');

  await db.collection('expenses').doc(id).delete();
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
  dailyTotals: Array<{ date: string; total: number }>;
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
      dailyTotals: [],
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
      const dailyTotals = new Map<string, number>();

      snapshot.forEach((doc) => {
        const data = doc.data() as Expense;
        const amount = Number(data.amount) || 0;
        total += amount;

        const key = data.category || 'Uncategorized';
        categoryTotals.set(key, (categoryTotals.get(key) || 0) + amount);

        let dateKey: string | null = null;
        if (data.createdAt && typeof (data.createdAt as any).toDate === 'function') {
          try {
            dateKey = (data.createdAt as any).toDate().toISOString().slice(0, 10);
          } catch {
            dateKey = null;
          }
        }
        if (!dateKey && data.createdAtISO) {
          dateKey = data.createdAtISO.slice(0, 10);
        }
        if (!dateKey) {
          dateKey = new Date().toISOString().slice(0, 10);
        }

        dailyTotals.set(dateKey, (dailyTotals.get(dateKey) || 0) + amount);
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
        dailyTotals: Array.from(dailyTotals.entries())
          .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
          .map(([date, total]) => ({ date, total })),
      });
    });
}
