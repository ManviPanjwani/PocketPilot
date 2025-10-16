import firebase from 'firebase/compat/app';
import { db, firebaseAuth } from '@/firebase';
import { logActivity } from '@/services/activity';

export type Goal = {
  id?: string;
  userId: string;
  title: string;
  targetAmount: number;
  category?: string;
  deadline?: string;
  createdAt?: firebase.firestore.Timestamp;
  updatedAt?: firebase.firestore.Timestamp;
};

export function observeGoals(handler: (goals: Goal[]) => void) {
  const user = firebaseAuth.currentUser;
  if (!user) {
    handler([]);
    return () => {};
  }

  return db
    .collection('goals')
    .where('userId', '==', user.uid)
    .orderBy('createdAt', 'desc')
    .onSnapshot((snapshot) => {
      handler(snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Goal) })));
    });
}

export async function addGoal(input: {
  title: string;
  targetAmount: number;
  deadline?: string;
  category?: string;
}) {
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('Not signed in');

  const doc = await db.collection('goals').add({
    userId: user.uid,
    title: input.title,
    targetAmount: input.targetAmount,
    category: input.category?.trim() || null,
    deadline: input.deadline || null,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  try {
    await logActivity({
      type: 'goal',
      referenceId: doc.id,
      title: input.title,
      amount: input.targetAmount,
      snapshot: {
        targetAmount: input.targetAmount,
        category: input.category?.trim() || null,
        deadline: input.deadline || null,
      },
    });
  } catch (err) {
    console.warn('Failed to log goal activity', err);
  }

  return doc.id;
}

export async function deleteGoal(goalId: string) {
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('Not signed in');

  await db.collection('goals').doc(goalId).delete();
}
