import { Injectable, effect, signal } from '@angular/core';
import type { Firestore } from 'firebase/firestore';
import { ExpenseItem } from './analytics.service';
import { AuthService } from './auth.service';
import { FirebaseService } from './firebase.service';

interface PendingExpenseChange {
  type: 'upsert' | 'delete';
  expense?: ExpenseItem;
}

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private readonly incomeStorageKey = 'expense-tracker.demo-income';
  private readonly guestStorageKey = 'expense-tracker.demo-expenses';
  private readonly pendingChanges = new Map<string, PendingExpenseChange>();
  private userId: string | null = null;
  private unsubscribeExpenses: (() => void) | null = null;
  private syncInProgress = false;
  private syncRetryTimer: ReturnType<typeof setTimeout> | null = null;

  readonly expenses = signal<ExpenseItem[]>(this.readExpenses(this.guestStorageKey));
  readonly monthlyIncome = signal<number>(this.readIncome());
  readonly syncStatus = signal('Local only');

  constructor(
    private readonly auth: AuthService,
    private readonly firebase: FirebaseService,
  ) {
    effect(() => this.setUser(this.auth.currentUser()?.uid ?? null));
    effect(() => {
      if (this.firebase.isOnline()) {
        void this.syncPendingChanges();
      }
    });
  }

  setMonthlyIncome(value: number): void {
    const next = Number(value) || 0;
    this.monthlyIncome.set(next);
    this.writeIncome(next);
  }

  addExpense(expense: Omit<ExpenseItem, 'id' | 'createdAt'>): void {
    const draft: ExpenseItem = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...expense,
      amount: Number(expense.amount) || 0,
      note: expense.note || '',
      category: expense.category || 'Other',
    };

    this.expenses.update((current) => {
      const next = [draft, ...current];
      this.persistExpenses(next);
      this.queueChange(draft.id, { type: 'upsert', expense: draft });
      return next;
    });
  }

  updateExpense(id: string, expense: Partial<ExpenseItem>): void {
    this.expenses.update((current) => {
      const next = current.map((item) => (item.id === id ? { ...item, ...expense } : item));
      this.persistExpenses(next);
      const updated = next.find((item) => item.id === id);
      if (updated) {
        this.queueChange(id, { type: 'upsert', expense: updated });
      }
      return next;
    });
  }

  deleteExpense(id: string): void {
    this.expenses.update((current) => {
      const next = current.filter((item) => item.id !== id);
      this.persistExpenses(next);
      this.queueChange(id, { type: 'delete' });
      return next;
    });
  }

  getExpensesByDateRange(range: 'all' | 'month' | '30d' | 'year'): ExpenseItem[] {
    const now = new Date();
    const items = this.expenses();

    if (range === 'all') {
      return items;
    }

    return items.filter((item) => {
      const date = new Date(item.date);
      const ms = now.getTime() - date.getTime();

      if (range === '30d') {
        return ms <= 30 * 24 * 60 * 60 * 1000 && ms >= 0;
      }

      if (range === 'month') {
        return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
      }

      return date.getFullYear() === now.getFullYear();
    });
  }

  private storageKey(): string {
    return this.userId ? `expense-tracker.${this.userId}.expenses` : this.guestStorageKey;
  }

  private queueKey(): string {
    return `expense-tracker.${this.userId ?? 'guest'}.pending-expenses`;
  }

  private readExpenses(key: string): ExpenseItem[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as ExpenseItem[]) : [];
    } catch {
      return [];
    }
  }

  private persistExpenses(items: ExpenseItem[]): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(this.storageKey(), JSON.stringify(items));
    } catch {
      this.syncStatus.set('Changes are in memory only; browser storage is unavailable.');
    }
  }

  private setUser(userId: string | null): void {
    if (this.userId === userId) {
      return;
    }

    this.unsubscribeExpenses?.();
    this.unsubscribeExpenses = null;
    if (this.syncRetryTimer) {
      clearTimeout(this.syncRetryTimer);
      this.syncRetryTimer = null;
    }
    this.userId = userId;
    this.pendingChanges.clear();

    if (userId) {
      const accountKey = this.storageKey();
      const accountExpenses = this.readExpenses(accountKey);
      const guestExpenses = this.readExpenses(this.guestStorageKey);
      const hasAccountData = this.hasStoredValue(accountKey);
      const initialExpenses = hasAccountData ? accountExpenses : guestExpenses;
      this.expenses.set(initialExpenses);
      this.persistExpenses(initialExpenses);
      this.readPendingChanges();
      if (!hasAccountData && guestExpenses.length) {
        for (const expense of guestExpenses) {
          this.queueChange(expense.id, { type: 'upsert', expense });
        }
      }
      this.listenToCloudExpenses();
      void this.syncPendingChanges();
    } else {
      this.expenses.set(this.readExpenses(this.guestStorageKey));
      this.syncStatus.set(this.firebase.isConfigured ? 'Sign in to sync' : 'Local only');
    }
  }

  private hasStoredValue(key: string): boolean {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem(key) !== null;
    } catch {
      return false;
    }
  }

  private readPendingChanges(): void {
    try {
      const raw = localStorage.getItem(this.queueKey());
      const pending = raw ? JSON.parse(raw) as Record<string, PendingExpenseChange> : {};
      for (const [id, change] of Object.entries(pending)) {
        this.pendingChanges.set(id, change);
      }
    } catch {
      this.pendingChanges.clear();
    }
  }

  private queueChange(id: string, change: PendingExpenseChange): void {
    if (!this.userId) {
      return;
    }

    this.pendingChanges.set(id, change);
    try {
      localStorage.setItem(this.queueKey(), JSON.stringify(Object.fromEntries(this.pendingChanges)));
    } catch {
      this.syncStatus.set('Saved locally, but the sync queue could not be persisted.');
      return;
    }
    void this.syncPendingChanges();
  }

  private listenToCloudExpenses(): void {
    const userId = this.userId;
    if (!userId) {
      return;
    }
    if (!this.firebase.isConfigured) {
      this.syncStatus.set(this.firebase.isConfigured ? 'Waiting for Firebase' : 'Local only');
      return;
    }

    void this.firebase.getFirestore().then(async (firestore) => {
      if (!firestore || this.userId !== userId) {
        return;
      }
      const { collection, onSnapshot } = await import('firebase/firestore');
      this.unsubscribeExpenses = onSnapshot(
        collection(firestore, 'users', userId, 'expenses'),
        (snapshot) => {
          const cloudExpenses = snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id } as ExpenseItem));
          const pending = new Map(this.pendingChanges);
          const merged = new Map(cloudExpenses.map((expense) => [expense.id, expense]));
          for (const [id, change] of pending) {
            if (change.type === 'delete') {
              merged.delete(id);
            } else if (change.expense) {
              merged.set(id, change.expense);
            }
          }
          this.expenses.set([...merged.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
          this.persistExpenses(this.expenses());
          this.syncStatus.set(pending.size ? 'Syncing changes' : 'Synced');
          void this.syncPendingChanges();
        },
        () => {
          this.syncStatus.set('Offline or Firebase unavailable; changes are saved locally');
          this.scheduleSyncRetry();
        },
      );
      }).catch(() => {
        this.syncStatus.set('Offline or Firebase unavailable; changes are saved locally');
        this.scheduleSyncRetry();
      });
  }

  private async syncPendingChanges(): Promise<void> {
    const userId = this.userId;
    if (this.syncInProgress || !userId || !this.firebase.isConfigured || !this.firebase.isOnline()) {
      if (userId && !this.firebase.isOnline()) {
        this.syncStatus.set('Offline; changes saved locally');
      }
      return;
    }

    this.syncInProgress = true;
    try {
      const firestore = await this.firebase.getFirestore();
      if (!firestore || this.userId !== userId) {
        return;
      }
      const { deleteDoc, doc, setDoc } = await import('firebase/firestore');
      for (const [id, change] of [...this.pendingChanges]) {
        const expenseRef = doc(firestore, 'users', userId, 'expenses', id);
        if (change.type === 'delete') {
          await deleteDoc(expenseRef);
        } else if (change.expense) {
          await setDoc(expenseRef, change.expense);
        }
        if (this.pendingChanges.get(id) === change) {
          this.pendingChanges.delete(id);
          this.persistPendingChanges();
        }
      }
      this.syncStatus.set('Synced');
    } catch {
      this.syncStatus.set('Offline or Firebase unavailable; changes are saved locally');
      this.scheduleSyncRetry();
    } finally {
      this.syncInProgress = false;
    }
  }

  private scheduleSyncRetry(): void {
    if (this.syncRetryTimer || !this.userId || !this.firebase.isOnline()) {
      return;
    }

    this.syncRetryTimer = setTimeout(() => {
      this.syncRetryTimer = null;
      void this.syncPendingChanges();
    }, 15_000);
  }

  private persistPendingChanges(): void {
    try {
      localStorage.setItem(this.queueKey(), JSON.stringify(Object.fromEntries(this.pendingChanges)));
    } catch {
      this.syncStatus.set('Some changes could not be queued for sync.');
    }
  }

  private readIncome(): number {
    if (typeof localStorage === 'undefined') {
      return 50000;
    }

    try {
      const raw = localStorage.getItem(this.incomeStorageKey);
      return raw ? Number(JSON.parse(raw)) || 0 : 50000;
    } catch {
      return 50000;
    }
  }

  private writeIncome(value: number): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(this.incomeStorageKey, JSON.stringify(value));
  }
}
