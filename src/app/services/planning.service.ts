import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import type { Firestore } from 'firebase/firestore';
import { ExpenseService } from './expense.service';
import { AuthService } from './auth.service';
import { FirebaseService } from './firebase.service';
import { CategoryBudget, RecurringTransaction, SavingsGoal, recurringDateForMonth } from './planning.model';

type PlanningCollection = 'recurring' | 'budgets' | 'goals';
type PlanningRecord = RecurringTransaction | CategoryBudget | SavingsGoal;

interface PendingPlanningChange {
  collection: PlanningCollection;
  id: string;
  type: 'upsert' | 'delete';
  record?: PlanningRecord;
}

@Injectable({ providedIn: 'root' })
export class PlanningService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly pendingChanges = new Map<string, PendingPlanningChange>();
  private readonly unsubscribeCollections: Array<() => void> = [];
  private userId: string | null = null;
  private syncInProgress = false;

  readonly recurringTransactions = signal<RecurringTransaction[]>(this.readLocal('guest', 'recurring'));
  readonly budgets = signal<CategoryBudget[]>(this.readLocal('guest', 'budgets'));
  readonly goals = signal<SavingsGoal[]>(this.readLocal('guest', 'goals'));

  constructor(
    private readonly auth: AuthService,
    private readonly firebase: FirebaseService,
    private readonly expenses: ExpenseService,
  ) {
    effect(() => this.setUser(this.auth.currentUser()?.uid ?? null));
    effect(() => {
      if (this.firebase.isOnline()) {
        void this.syncPendingChanges();
      }
    });
    effect(() => {
      const recurring = this.recurringTransactions();
      this.expenses.expenses();
      this.generateDueExpenses(recurring);
    });
    this.scheduleRecurringCheck();
  }

  addRecurringTransaction(input: Omit<RecurringTransaction, 'id' | 'createdAt'>): void {
    const record: RecurringTransaction = {
      ...input,
      id: crypto.randomUUID(),
      name: input.name.trim(),
      amount: Number(input.amount),
      dueDay: Math.min(31, Math.max(1, Math.floor(input.dueDay))),
      createdAt: new Date().toISOString(),
    };
    this.upsert('recurring', this.recurringTransactions(), record);
  }

  updateRecurringTransaction(record: RecurringTransaction): void {
    this.upsert('recurring', this.recurringTransactions(), { ...record, name: record.name.trim() });
  }

  deleteRecurringTransaction(id: string): void {
    this.remove('recurring', this.recurringTransactions(), id);
  }

  setBudget(category: string, monthlyLimit: number): void {
    const id = `budget-${category.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const budget = { id, category, monthlyLimit: Number(monthlyLimit) };
    this.upsert('budgets', this.budgets(), budget);
  }

  deleteBudget(id: string): void {
    this.remove('budgets', this.budgets(), id);
  }

  addGoal(input: Omit<SavingsGoal, 'id' | 'createdAt' | 'savedAmount'>): void {
    const goal: SavingsGoal = {
      ...input,
      id: crypto.randomUUID(),
      name: input.name.trim(),
      targetAmount: Number(input.targetAmount),
      savedAmount: 0,
      createdAt: new Date().toISOString(),
    };
    this.upsert('goals', this.goals(), goal);
  }

  contributeToGoal(id: string, amount: number): void {
    const goal = this.goals().find((item) => item.id === id);
    if (!goal || !Number.isFinite(amount) || amount <= 0) {
      return;
    }
    this.upsert('goals', this.goals(), { ...goal, savedAmount: goal.savedAmount + amount });
  }

  deleteGoal(id: string): void {
    this.remove('goals', this.goals(), id);
  }

  private generateDueExpenses(recurring: RecurringTransaction[]): void {
    const today = new Date();
    const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    for (const item of recurring) {
      if (!item.active || item.dueDay > today.getDate()) {
        continue;
      }
      const exists = this.expenses.expenses().some((expense) =>
        expense.recurringId === item.id && expense.recurringMonth === monthKey,
      );
      if (exists) {
        continue;
      }
      this.expenses.addExpense({
        amount: item.amount,
        category: item.category,
        source: item.source,
        date: recurringDateForMonth(today.getFullYear(), today.getMonth(), item.dueDay),
        note: `${item.name} (recurring)`,
      }, { id: `recurring-${item.id}-${monthKey}`, recurringId: item.id, recurringMonth: monthKey });
    }
  }

  private scheduleRecurringCheck(): void {
    if (!this.isBrowser) return;
    const now = new Date();
    const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
    setTimeout(() => {
      this.generateDueExpenses(this.recurringTransactions());
      this.scheduleRecurringCheck();
    }, nextDay.getTime() - now.getTime());
  }

  private upsert<T extends PlanningRecord>(collection: PlanningCollection, records: T[], record: T): void {
    const next = [...records.filter((item) => item.id !== record.id), record];
    this.writeCollection(collection, next);
    this.queueChange({ collection, id: record.id, type: 'upsert', record });
  }

  private remove<T extends PlanningRecord>(collection: PlanningCollection, records: T[], id: string): void {
    this.writeCollection(collection, records.filter((item) => item.id !== id));
    this.queueChange({ collection, id, type: 'delete' });
  }

  private writeCollection(collection: PlanningCollection, records: PlanningRecord[]): void {
    switch (collection) {
      case 'recurring':
        this.recurringTransactions.set(records as RecurringTransaction[]);
        break;
      case 'budgets':
        this.budgets.set(records as CategoryBudget[]);
        break;
      case 'goals':
        this.goals.set(records as SavingsGoal[]);
        break;
    }
    this.persistLocal(collection, records);
  }

  private queueChange(change: PendingPlanningChange): void {
    if (!this.userId) {
      return;
    }
    this.pendingChanges.set(`${change.collection}:${change.id}`, change);
    this.persistPendingChanges();
    void this.syncPendingChanges();
  }

  private setUser(userId: string | null): void {
    if (this.userId === userId) {
      return;
    }
    for (const unsubscribe of this.unsubscribeCollections.splice(0)) {
      unsubscribe();
    }
    this.userId = userId;
    this.pendingChanges.clear();

    if (!userId) {
      this.recurringTransactions.set(this.readLocal('guest', 'recurring'));
      this.budgets.set(this.readLocal('guest', 'budgets'));
      this.goals.set(this.readLocal('guest', 'goals'));
      return;
    }

    for (const collection of ['recurring', 'budgets', 'goals'] as const) {
      const accountKey = this.localKey(userId, collection);
      const hasAccountData = this.hasStoredValue(accountKey);
      const records = this.readLocal(userId, collection);
      const guestRecords = this.readLocal('guest', collection);
      this.writeCollection(collection, hasAccountData ? records : guestRecords);
      this.readPendingChanges(userId);
      if (!hasAccountData) {
        for (const record of guestRecords) {
          this.pendingChanges.set(`${collection}:${record.id}`, { collection, id: record.id, type: 'upsert', record });
        }
      }
    }
    this.persistPendingChanges();
    void this.listenToCloudCollections(userId);
    void this.syncPendingChanges();
  }

  private async listenToCloudCollections(userId: string): Promise<void> {
    if (!this.firebase.isConfigured) {
      return;
    }
    const firestore = await this.firebase.getFirestore();
    if (!firestore || this.userId !== userId) {
      return;
    }
    const { collection, onSnapshot } = await import('firebase/firestore');
    for (const name of ['recurring', 'budgets', 'goals'] as const) {
      const unsubscribe = onSnapshot(
        collection(firestore, 'users', userId, name),
        (snapshot) => {
          const records = snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id }) as PlanningRecord);
          const merged = new Map(records.map((record) => [record.id, record]));
          for (const change of this.pendingChanges.values()) {
            if (change.collection !== name) continue;
            if (change.type === 'delete') merged.delete(change.id);
            else if (change.record) merged.set(change.id, change.record);
          }
          this.writeCollection(name, [...merged.values()]);
          void this.syncPendingChanges();
        },
      );
      this.unsubscribeCollections.push(unsubscribe);
    }
  }

  private async syncPendingChanges(): Promise<void> {
    const userId = this.userId;
    if (this.syncInProgress || !userId || !this.firebase.isConfigured || !this.firebase.isOnline()) {
      return;
    }
    this.syncInProgress = true;
    try {
      const firestore = await this.firebase.getFirestore();
      if (!firestore || this.userId !== userId) return;
      await this.flushPendingChanges(firestore, userId);
    } catch {
      // Local storage remains authoritative until the next online sync attempt.
    } finally {
      this.syncInProgress = false;
    }
  }

  private async flushPendingChanges(firestore: Firestore, userId: string): Promise<void> {
    const { deleteDoc, doc, setDoc } = await import('firebase/firestore');
    for (const [key, change] of [...this.pendingChanges]) {
      const reference = doc(firestore, 'users', userId, change.collection, change.id);
      if (change.type === 'delete') {
        await deleteDoc(reference);
      } else if (change.record) {
        await setDoc(reference, change.record);
      }
      if (this.pendingChanges.get(key) === change) {
        this.pendingChanges.delete(key);
        this.persistPendingChanges();
      }
    }
  }

  private readPendingChanges(userId: string): void {
    try {
      const raw = localStorage.getItem(`expense-tracker.${userId}.pending-planning`);
      const changes = raw ? JSON.parse(raw) as PendingPlanningChange[] : [];
      for (const change of changes) {
        this.pendingChanges.set(`${change.collection}:${change.id}`, change);
      }
    } catch {
      this.pendingChanges.clear();
    }
  }

  private persistPendingChanges(): void {
    if (!this.userId) return;
    try {
      localStorage.setItem(`expense-tracker.${this.userId}.pending-planning`, JSON.stringify([...this.pendingChanges.values()]));
    } catch {}
  }

  private readLocal<T extends PlanningRecord>(userId: string, collection: PlanningCollection): T[] {
    try {
      const raw = localStorage.getItem(this.localKey(userId, collection));
      const records = raw ? JSON.parse(raw) as unknown : [];
      return Array.isArray(records) ? records as T[] : [];
    } catch {
      return [];
    }
  }

  private persistLocal(collection: PlanningCollection, records: PlanningRecord[]): void {
    try {
      localStorage.setItem(this.localKey(this.userId ?? 'guest', collection), JSON.stringify(records));
    } catch {}
  }

  private localKey(userId: string, collection: PlanningCollection): string {
    return `expense-tracker.${userId}.${collection}`;
  }

  private hasStoredValue(key: string): boolean {
    try {
      return localStorage.getItem(key) !== null;
    } catch {
      return false;
    }
  }
}