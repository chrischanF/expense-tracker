import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import type { Wallet, WalletBalance } from '../models/wallet.model';
import { normalizeDateToIsoUtc } from '../utils/date-normalization';
import { AuthService } from './auth.service';
import { ExpenseService } from './expense.service';
import { ExchangeRateService } from './exchange-rate.service';
import { FirebaseService } from './firebase.service';
import { IncomeStreamService } from './income-stream.service';
import { AppPreferencesService } from './app-preferences.service';

const GUEST_STORAGE_KEY = 'expense-tracker.demo-wallets';

@Injectable({ providedIn: 'root' })
export class WalletService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly pendingChanges = new Map<string, Wallet | null>();
  private userId: string | null = null;
  private unsubscribe: (() => void) | null = null;
  private syncing = false;
  private revision = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  readonly wallets = signal<Wallet[]>(this.readWallets(GUEST_STORAGE_KEY));
  readonly selectedWalletId = signal<string | null>(null);
  readonly selectedWallet = computed(
    () => this.wallets().find((wallet) => wallet.id === this.selectedWalletId()) ?? null,
  );
  readonly walletBalances = computed<WalletBalance[]>(() => {
    const expenses = this.expenseService.expenses();
    const incomeStreams = this.incomeStreams.streams();
    const payPeriods = this.expenseService.incomeProfile().payPeriods ?? [];
    const currency = this.preferences.currency();
    return this.wallets().map((wallet) => {
      const totalInflows = [
        ...incomeStreams.filter((stream) => stream.walletId === wallet.id),
        ...payPeriods.filter((period) => period.walletId === wallet.id),
      ].reduce((total, entry) => total + entry.amount, 0);
      const totalExpenses = expenses
        .filter((expense) => expense.walletId === wallet.id)
        .reduce(
          (total, expense) => total + (this.exchangeRates.toBase(expense.amount, expense.currency || currency) ?? 0),
          0,
        );
      return {
        wallet,
        initialBalance: wallet.initialBalance,
        totalInflows,
        totalExpenses,
        remainingBalance: wallet.initialBalance + totalInflows - totalExpenses,
      };
    });
  });

  constructor(
    private readonly auth: AuthService,
    private readonly firebase: FirebaseService,
    private readonly expenseService: ExpenseService,
    private readonly incomeStreams: IncomeStreamService,
    private readonly exchangeRates: ExchangeRateService,
    private readonly preferences: AppPreferencesService,
  ) {
    effect(() => this.setUser(this.auth.currentUser()?.uid ?? null));
    effect(() => {
      if (this.firebase.isOnline()) void this.syncPendingChanges();
    });
  }

  getWallets(): Wallet[] {
    return this.wallets();
  }

  addWallet(wallet: Omit<Wallet, 'id' | 'createdAt'>): Wallet {
    const record: Wallet = {
      ...wallet,
      id: crypto.randomUUID(),
      name: wallet.name.trim(),
      initialBalance: Number(wallet.initialBalance) || 0,
      createdAt: normalizeDateToIsoUtc(new Date()),
    };
    this.write([...this.wallets(), record]);
    return record;
  }

  updateWallet(wallet: Wallet): void {
    this.write(this.wallets().map((current) => (current.id === wallet.id ? wallet : current)));
  }

  deleteWallet(id: string): void {
    this.write(this.wallets().filter((wallet) => wallet.id !== id));
    if (this.selectedWalletId() === id) this.selectedWalletId.set(null);
  }

  selectWallet(id: string | null): void {
    this.selectedWalletId.set(this.selectedWalletId() === id ? null : id);
  }

  balanceFor(id: string): WalletBalance | undefined {
    return this.walletBalances().find((balance) => balance.wallet.id === id);
  }

  private storageKey(userId = this.userId): string {
    return userId ? `expense-tracker.${userId}.wallets` : GUEST_STORAGE_KEY;
  }

  private pendingStorageKey(userId = this.userId): string {
    return `expense-tracker.${userId ?? 'guest'}.pending-wallets`;
  }

  private readWallets(key: string): Wallet[] {
    if (!this.isBrowser) return [];
    try {
      const raw = window.localStorage.getItem(key);
      const value: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(value) ? value.filter((item): item is Wallet => this.isWallet(item)) : [];
    } catch {
      return [];
    }
  }

  private isWallet(value: unknown): value is Wallet {
    if (typeof value !== 'object' || value === null) return false;
    const wallet = value as Partial<Wallet>;
    return (
      typeof wallet.id === 'string' &&
      typeof wallet.name === 'string' &&
      typeof wallet.bankCode === 'string' &&
      typeof wallet.accountType === 'string' &&
      typeof wallet.initialBalance === 'number' &&
      Number.isFinite(wallet.initialBalance) &&
      typeof wallet.colorHex === 'string' &&
      typeof wallet.createdAt === 'string'
    );
  }

  private write(wallets: Wallet[]): void {
    this.wallets.set(wallets);
    this.persist(wallets, this.storageKey());
    if (this.userId) {
      this.revision++;
      for (const wallet of wallets) this.pendingChanges.set(wallet.id, wallet);
      const currentIds = new Set(wallets.map((wallet) => wallet.id));
      for (const pendingId of this.pendingChanges.keys()) {
        if (!currentIds.has(pendingId)) this.pendingChanges.set(pendingId, null);
      }
      this.persistPendingChanges();
      void this.syncPendingChanges();
    }
  }

  private persist(wallets: Wallet[], key: string): void {
    if (!this.isBrowser) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(wallets));
    } catch {}
  }

  private readPendingChanges(userId: string): void {
    if (!this.isBrowser) return;
    try {
      const raw = window.localStorage.getItem(this.pendingStorageKey(userId));
      const value: unknown = raw ? JSON.parse(raw) : {};
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return;
      for (const [id, wallet] of Object.entries(value)) {
        if (wallet === null) this.pendingChanges.set(id, null);
        else if (this.isWallet(wallet)) this.pendingChanges.set(id, wallet);
      }
    } catch {}
  }

  private persistPendingChanges(): void {
    if (!this.isBrowser) return;
    try {
      const key = this.pendingStorageKey();
      if (this.pendingChanges.size)
        window.localStorage.setItem(key, JSON.stringify(Object.fromEntries(this.pendingChanges)));
      else window.localStorage.removeItem(key);
    } catch {}
  }

  private hasStoredValue(key: string): boolean {
    try {
      return this.isBrowser && window.localStorage.getItem(key) !== null;
    } catch {
      return false;
    }
  }

  private setUser(userId: string | null): void {
    if (this.userId === userId) return;
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.pendingChanges.clear();
    this.userId = userId;
    this.selectedWalletId.set(null);
    if (!userId) {
      this.wallets.set(this.readWallets(GUEST_STORAGE_KEY));
      this.selectedWalletId.set(null);
      return;
    }

    const key = this.storageKey(userId);
    const hasAccountData = this.hasStoredValue(key);
    const storedWallets = this.readWallets(hasAccountData ? key : GUEST_STORAGE_KEY);
    this.readPendingChanges(userId);
    const walletsById = new Map(storedWallets.map((wallet) => [wallet.id, wallet]));
    for (const [id, wallet] of this.pendingChanges) {
      if (wallet) walletsById.set(id, wallet);
      else walletsById.delete(id);
    }
    const initial = [...walletsById.values()];
    this.wallets.set(initial);
    this.persist(initial, key);
    if (!hasAccountData) {
      for (const wallet of initial) this.pendingChanges.set(wallet.id, wallet);
    }
    this.persistPendingChanges();
    this.listenToCloudWallets(userId);
    void this.syncPendingChanges();
  }

  private listenToCloudWallets(userId: string): void {
    if (!this.firebase.isConfigured) return;
    void this.firebase
      .getFirestore()
      .then(async (firestore) => {
        if (!firestore || this.userId !== userId) return;
        const { collection, onSnapshot } = await import('firebase/firestore');
        this.unsubscribe = onSnapshot(
          collection(firestore, 'users', userId, 'wallets'),
          (snapshot) => {
            if (this.userId !== userId) return;
            const cloudWallets = snapshot.docs
              .map((item) => ({ ...item.data(), id: item.id }))
              .filter((item): item is Wallet => this.isWallet(item));
            const merged = new Map(cloudWallets.map((wallet) => [wallet.id, wallet]));
            for (const [id, wallet] of this.pendingChanges) {
              if (wallet) merged.set(id, wallet);
              else merged.delete(id);
            }
            const wallets = [...merged.values()];
            this.wallets.set(wallets);
            this.persist(wallets, this.storageKey(userId));
          },
          (error) => console.error('Wallet Firestore listen failed:', error),
        );
      })
      .catch((error) => console.error('Wallet Firestore listen failed:', error));
  }

  private async syncPendingChanges(): Promise<void> {
    const userId = this.userId;
    if (
      !userId ||
      !this.pendingChanges.size ||
      this.syncing ||
      !this.firebase.isConfigured ||
      !this.firebase.isOnline()
    )
      return;
    this.syncing = true;
    const revision = this.revision;
    let failed = false;
    try {
      const firestore = await this.firebase.getFirestore();
      if (!firestore) {
        failed = true;
        return;
      }
      if (this.userId !== userId) return;
      const { deleteDoc, doc, setDoc } = await import('firebase/firestore');
      for (const [id, wallet] of [...this.pendingChanges]) {
        if (this.userId !== userId) return;
        if (wallet) await setDoc(doc(firestore, 'users', userId, 'wallets', id), wallet);
        else await deleteDoc(doc(firestore, 'users', userId, 'wallets', id));
        if (this.userId !== userId) return;
        if (this.pendingChanges.get(id) === wallet) {
          this.pendingChanges.delete(id);
          this.persistPendingChanges();
        }
      }
    } catch (error) {
      failed = true;
      console.error('Wallet Firestore sync failed:', error);
    } finally {
      this.syncing = false;
      if (failed && this.userId === userId) this.scheduleRetry(userId);
      else if (this.userId && this.userId !== userId && this.pendingChanges.size) void this.syncPendingChanges();
      else if (this.userId === userId && this.pendingChanges.size && revision !== this.revision)
        void this.syncPendingChanges();
    }
  }

  private scheduleRetry(userId: string): void {
    if (this.retryTimer || this.userId !== userId) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.syncPendingChanges();
    }, 15_000);
  }
}
