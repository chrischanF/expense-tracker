import { computed, Injectable, effect, signal } from '@angular/core';
import type { Firestore } from 'firebase/firestore';
import {
  averagePayAmount,
  payAmountsForProfile,
  toLocalDateInputValue,
  toMonthlyIncome,
} from '../features/income/income.model';
import { AuthService } from './auth.service';
import { FirebaseService } from './firebase.service';
import { normalizeDateToIsoUtc } from '../utils/date-normalization';
import type { IncomeProfile, PayPeriod } from '../types/income.types';
import type { ExpenseItem } from '../types/analytics.types';
import type { PendingExpenseChange } from '../types/expense.types';

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private readonly guestIncomeStorageKey = 'expense-tracker.demo-income';
  private readonly guestStorageKey = 'expense-tracker.demo-expenses';
  private readonly pendingChanges = new Map<string, PendingExpenseChange>();
  private userId: string | null = null;
  private unsubscribeExpenses: (() => void) | null = null;
  private unsubscribeIncome: (() => void) | null = null;
  private syncInProgress = false;
  private incomeSyncInProgress = false;
  private incomeNeedsSync = false;
  private syncRetryTimer: ReturnType<typeof setTimeout> | null = null;

  readonly expenses = signal<ExpenseItem[]>(this.readExpenses(this.guestStorageKey));
  readonly incomeProfile = signal<IncomeProfile>(this.readIncomeProfile(this.incomeStorageKey(null)));
  readonly monthlyIncome = computed(() => toMonthlyIncome(this.incomeProfile()));
  readonly syncStatus = signal('Local only');
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);

  constructor(
    private readonly auth: AuthService,
    private readonly firebase: FirebaseService,
  ) {
    effect(() => this.setUser(this.auth.currentUser()?.uid ?? null));
    effect(() => {
      if (this.firebase.isOnline()) {
        void this.syncPendingChanges();
        void this.syncIncomeProfile();
      }
    });
  }

  setIncomeProfile(profile: IncomeProfile): void {
    const payAmounts = payAmountsForProfile(profile);
    const next: IncomeProfile = {
      amount: averagePayAmount(payAmounts),
      payAmounts,
      frequency: profile.frequency,
      nextPayDate: normalizeDateToIsoUtc(profile.nextPayDate),
      payPeriods: profile.payPeriods ?? [],
    };
    this.incomeProfile.set(next);
    this.writeIncomeProfile(next, this.incomeStorageKey());
    if (this.userId) {
      this.incomeNeedsSync = true;
      void this.syncIncomeProfile();
    }
  }

  addExpense(
    expense: Omit<ExpenseItem, 'id' | 'createdAt' | 'source'> & { source?: string },
    options: { id?: string; recurringId?: string; recurringMonth?: string } = {},
  ): void {
    const draft = this.normalizeExpense({
      id: options.id ?? crypto.randomUUID(),
      createdAt: normalizeDateToIsoUtc(new Date()),
      ...expense,
      date: normalizeDateToIsoUtc(expense.date),
      amount: Number(expense.amount) || 0,
      note: expense.note || '',
      category: expense.category || 'Other',
      source: expense.source?.trim() || 'Other',
      ...(options.recurringId ? { recurringId: options.recurringId, recurringMonth: options.recurringMonth } : {}),
    });

    this.expenses.update((current) => {
      const next = [draft, ...current];
      this.persistExpenses(next);
      this.queueChange(draft.id, { type: 'upsert', expense: draft });
      return next;
    });
  }

  updateExpense(id: string, expense: Partial<ExpenseItem>): void {
    this.expenses.update((current) => {
      const next = current.map((item) => (item.id === id ? this.normalizeExpense({ ...item, ...expense }) : item));
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
    const localToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDayStart = new Date(localToday);
    thirtyDayStart.setDate(thirtyDayStart.getDate() - 29);
    const items = this.expenses();

    if (range === 'all') {
      return items;
    }

    return items.filter((item) => {
      const timestamp = new Date(item.date);
      if (Number.isNaN(timestamp.getTime())) return false;
      const date = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate());

      if (range === '30d') {
        return date >= thirtyDayStart && date <= localToday;
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
      const parsed = raw ? (JSON.parse(raw) as ExpenseItem[]) : [];
      return Array.isArray(parsed) ? parsed.map((expense) => this.normalizeExpense(expense)) : [];
    } catch {
      return [];
    }
  }

  private normalizeExpense(expense: ExpenseItem): ExpenseItem {
    return {
      ...expense,
      date: normalizeDateToIsoUtc(expense.date),
      createdAt: normalizeDateToIsoUtc(expense.createdAt),
      source: typeof expense.source === 'string' && expense.source.trim() ? expense.source.trim() : 'Other',
    };
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
    this.unsubscribeIncome?.();
    this.unsubscribeExpenses = null;
    this.unsubscribeIncome = null;
    if (this.syncRetryTimer) {
      clearTimeout(this.syncRetryTimer);
      this.syncRetryTimer = null;
    }
    this.userId = userId;
    this.incomeSyncInProgress = false;
    this.incomeNeedsSync = false;
    this.incomeProfile.set(this.readIncomeProfile(this.incomeStorageKey()));
    this.pendingChanges.clear();
    this.isLoading.set(false);
    this.isSaving.set(false);

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
      this.listenToCloudIncome();
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
      const pending = raw ? (JSON.parse(raw) as Record<string, PendingExpenseChange>) : {};
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

    this.isLoading.set(true);
    void this.firebase
      .getFirestore()
      .then(async (firestore) => {
        if (!firestore || this.userId !== userId) {
          if (this.userId === userId) this.isLoading.set(false);
          return;
        }
        const { collection, onSnapshot } = await import('firebase/firestore');
        this.unsubscribeExpenses = onSnapshot(
          collection(firestore, 'users', userId, 'expenses'),
          (snapshot) => {
            if (this.userId !== userId) return;
            this.isLoading.set(false);
            const cloudExpenses = snapshot.docs.map((entry) =>
              this.normalizeExpense({ ...entry.data(), id: entry.id } as ExpenseItem),
            );
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
            if (this.userId === userId) this.isLoading.set(false);
            this.syncStatus.set('Listen failed: Offline or Firebase unavailable; changes are saved locally');
            this.scheduleSyncRetry();
          },
        );
      })
      .catch(() => {
        if (this.userId === userId) this.isLoading.set(false);
        this.syncStatus.set('Listen failed: Offline or Firebase unavailable; changes are saved locally');
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
    if (!this.pendingChanges.size) return;

    this.syncInProgress = true;
    this.isSaving.set(true);
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
          await setDoc(expenseRef, this.normalizeExpense(change.expense));
        }
        if (this.pendingChanges.get(id) === change) {
          this.pendingChanges.delete(id);
          this.persistPendingChanges();
        }
      }
      this.syncStatus.set('Online');
    } catch (e) {
      console.log('Sync Error: ', e);
      this.syncStatus.set('Sync failed: Firebase unavailable; changes are saved locally');
      this.scheduleSyncRetry();
    } finally {
      this.syncInProgress = false;
      this.isSaving.set(false);
    }
  }

  private scheduleSyncRetry(): void {
    if (this.syncRetryTimer || !this.userId || !this.firebase.isOnline()) {
      return;
    }

    this.syncRetryTimer = setTimeout(() => {
      this.syncRetryTimer = null;
      void this.syncPendingChanges();
      void this.syncIncomeProfile();
    }, 15_000);
  }

  private persistPendingChanges(): void {
    try {
      localStorage.setItem(this.queueKey(), JSON.stringify(Object.fromEntries(this.pendingChanges)));
    } catch {
      this.syncStatus.set('Some changes could not be queued for sync.');
    }
  }

  private incomeStorageKey(userId = this.userId): string {
    return userId ? `expense-tracker.${userId}.income` : this.guestIncomeStorageKey;
  }

  private readIncomeProfile(key: string): IncomeProfile {
    if (typeof localStorage === 'undefined') {
      return this.defaultIncomeProfile();
    }

    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        return this.defaultIncomeProfile();
      }

      return this.normalizeIncomeProfile(JSON.parse(raw)) ?? this.defaultIncomeProfile();
    } catch {
      return this.defaultIncomeProfile();
    }
  }

  private defaultIncomeProfile(): IncomeProfile {
    return {
      amount: 50000,
      payAmounts: [50000],
      frequency: 'monthly',
      nextPayDate: normalizeDateToIsoUtc(toLocalDateInputValue(new Date())),
    };
  }

  private normalizeIncomeProfile(value: unknown): IncomeProfile | null {
    if (typeof value !== 'object' || value === null) return null;
    const profile = value as Partial<IncomeProfile>;
    const frequencies: IncomeProfile['frequency'][] = ['weekly', 'biweekly', 'twice-monthly', 'monthly'];
    if (
      typeof profile.amount !== 'number' ||
      !Number.isFinite(profile.amount) ||
      profile.amount < 0 ||
      !frequencies.includes(profile.frequency as IncomeProfile['frequency']) ||
      typeof profile.nextPayDate !== 'string' ||
      (profile.payAmounts !== undefined &&
        (!Array.isArray(profile.payAmounts) ||
          profile.payAmounts.some((amount) => typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0)))
    ) {
      return null;
    }

    const candidate: IncomeProfile = {
      amount: profile.amount,
      payAmounts: profile.payAmounts,
      frequency: profile.frequency as IncomeProfile['frequency'],
      nextPayDate: normalizeDateToIsoUtc(profile.nextPayDate),
      payPeriods: this.normalizePayPeriods(profile.payPeriods),
    };
    const payAmounts = payAmountsForProfile(candidate);
    return { ...candidate, amount: averagePayAmount(payAmounts), payAmounts };
  }

  private normalizePayPeriods(value: unknown): PayPeriod[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
      if (typeof item !== 'object' || item === null) return [];
      const period = item as Partial<PayPeriod>;
      if (
        typeof period.startDate !== 'string' ||
        typeof period.endDate !== 'string' ||
        typeof period.amount !== 'number' ||
        !Number.isFinite(period.amount) ||
        period.amount < 0
      ) {
        return [];
      }
      try {
        const startDate = normalizeDateToIsoUtc(period.startDate);
        const endDate = normalizeDateToIsoUtc(period.endDate);
        if (toLocalDateInputValue(startDate) > toLocalDateInputValue(endDate)) return [];
        return [
          {
            id: typeof period.id === 'string' && period.id ? period.id : `period-${toLocalDateInputValue(startDate)}`,
            startDate,
            endDate,
            amount: period.amount,
          },
        ];
      } catch {
        return [];
      }
    });
  }

  private listenToCloudIncome(): void {
    const userId = this.userId;
    if (!userId || !this.firebase.isConfigured) return;

    void this.firebase
      .getFirestore()
      .then(async (firestore) => {
        if (!firestore || this.userId !== userId) return;
        const { doc, onSnapshot } = await import('firebase/firestore');
        this.unsubscribeIncome = onSnapshot(
          doc(firestore, 'users', userId, 'income', 'profile'),
          { includeMetadataChanges: true },
          (snapshot) => {
            if (this.userId !== userId) return;
            if (snapshot.exists()) {
              if (this.incomeNeedsSync) return;
              const profile = this.normalizeIncomeProfile(snapshot.data());
              if (!profile) return;
              this.incomeProfile.set(profile);
              this.writeIncomeProfile(profile, this.incomeStorageKey(userId));
              return;
            }
            if (!snapshot.metadata.fromCache) {
              const accountKey = this.incomeStorageKey(userId);
              const profile =
                this.readCurrentIncomeProfile(accountKey) ?? this.readCurrentIncomeProfile(this.guestIncomeStorageKey);
              if (profile) {
                this.incomeProfile.set(profile);
                this.writeIncomeProfile(profile, accountKey);
                this.incomeNeedsSync = true;
                void this.syncIncomeProfile();
              }
            }
          },
          () => this.syncStatus.set('Income sync failed; the saved profile remains on this device.'),
        );
      })
      .catch(() => this.syncStatus.set('Income sync failed; the saved profile remains on this device.'));
  }

  private readCurrentIncomeProfile(key: string): IncomeProfile | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(key);
      return raw ? this.normalizeIncomeProfile(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }

  private async syncIncomeProfile(): Promise<void> {
    const userId = this.userId;
    if (
      !userId ||
      !this.incomeNeedsSync ||
      this.incomeSyncInProgress ||
      !this.firebase.isConfigured ||
      !this.firebase.isOnline()
    )
      return;

    const profile = this.incomeProfile();
    this.incomeSyncInProgress = true;
    let synced = false;
    try {
      const firestore = await this.firebase.getFirestore();
      if (!firestore || this.userId !== userId) return;
      const { doc, setDoc } = await import('firebase/firestore');
      await setDoc(doc(firestore, 'users', userId, 'income', 'profile'), {
        ...profile,
        monthlyIncome: toMonthlyIncome(profile),
      });
      if (this.userId === userId && this.incomeProfile() === profile) {
        this.incomeNeedsSync = false;
      }
      synced = true;
    } catch (error) {
      console.error('Income Firestore sync failed:', error);
      const message = error instanceof Error ? error.message : String(error);
      this.syncStatus.set(`Income sync failed: ${message}`);
      this.scheduleSyncRetry();
    } finally {
      this.incomeSyncInProgress = false;
      if (synced && this.userId === userId && this.incomeNeedsSync) {
        void this.syncIncomeProfile();
      } else if (synced && this.userId === userId) {
        this.syncStatus.set('Income synced');
      }
    }
  }

  private writeIncomeProfile(profile: IncomeProfile, key: string): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(
        key,
        JSON.stringify({ ...profile, nextPayDate: normalizeDateToIsoUtc(profile.nextPayDate) }),
      );
    } catch {
      this.syncStatus.set('Income is updated for this session, but browser storage is unavailable.');
    }
  }
}
