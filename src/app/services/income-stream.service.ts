import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { additionalIncomeForMonth } from '../features/income/income.model';
import type { IncomeStream } from '../types/income.types';
import { normalizeDateToIsoUtc } from '../utils/date-normalization';
import { AuthService } from './auth.service';
import { FirebaseService } from './firebase.service';

const GUEST_STORAGE_KEY = 'expense-tracker.demo-income-streams';

@Injectable({ providedIn: 'root' })
export class IncomeStreamService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private userId: string | null = null;
  private unsubscribe: (() => void) | null = null;
  private syncPending = false;
  private syncInProgress = false;
  private revision = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  readonly streams = signal<IncomeStream[]>(this.readStreams(GUEST_STORAGE_KEY));
  readonly currentMonthTotal = computed(() => additionalIncomeForMonth(this.streams()));

  constructor(
    private readonly auth: AuthService,
    private readonly firebase: FirebaseService,
  ) {
    effect(() => this.setUser(this.auth.currentUser()?.uid ?? null));
    effect(() => {
      if (this.firebase.isOnline()) void this.syncStreams();
    });
  }

  add(stream: Omit<IncomeStream, 'id' | 'createdAt'>): void {
    const record: IncomeStream = {
      ...stream,
      id: crypto.randomUUID(),
      name: stream.name.trim(),
      amount: Number(stream.amount),
      date: normalizeDateToIsoUtc(stream.date),
      createdAt: normalizeDateToIsoUtc(new Date()),
    };
    this.write([...this.streams(), record]);
  }

  update(stream: IncomeStream): void {
    this.write(
      this.streams().map((entry) =>
        entry.id === stream.id
          ? {
              ...stream,
              name: stream.name.trim(),
              date: normalizeDateToIsoUtc(stream.date),
              createdAt: normalizeDateToIsoUtc(stream.createdAt),
            }
          : entry,
      ),
    );
  }

  delete(id: string): void {
    this.write(this.streams().filter((entry) => entry.id !== id));
  }

  private readStreams(key: string): IncomeStream[] {
    if (!this.isBrowser) return [];
    try {
      const raw = window.localStorage.getItem(key);
      const saved: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(saved)
        ? (saved as IncomeStream[]).map((stream) => ({
            ...stream,
            date: normalizeDateToIsoUtc(stream.date),
            createdAt: normalizeDateToIsoUtc(stream.createdAt),
          }))
        : [];
    } catch {
      return [];
    }
  }

  private write(streams: IncomeStream[]): void {
    this.streams.set(streams);
    this.persistStreams(streams, this.storageKey());
    if (this.userId) {
      this.syncPending = true;
      void this.syncStreams();
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
    this.userId = userId;
    this.revision++;
    this.syncPending = false;

    if (!userId) {
      this.streams.set(this.readStreams(GUEST_STORAGE_KEY));
      return;
    }

    const accountKey = this.storageKey(userId);
    const hasAccountData = this.hasStoredValue(accountKey);
    const streams = this.readStreams(hasAccountData ? accountKey : GUEST_STORAGE_KEY);
    this.revision++;
    this.streams.set(streams);
    this.persistStreams(streams, accountKey);
    this.syncPending = streams.length > 0;
    this.listenToCloudStreams(userId);
    void this.syncStreams();
  }

  private storageKey(userId = this.userId): string {
    return userId ? `expense-tracker.${userId}.income-streams` : GUEST_STORAGE_KEY;
  }

  private hasStoredValue(key: string): boolean {
    try {
      return this.isBrowser && window.localStorage.getItem(key) !== null;
    } catch {
      return false;
    }
  }

  private persistStreams(streams: IncomeStream[], key: string): void {
    if (!this.isBrowser) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(streams));
    } catch {}
  }

  private listenToCloudStreams(userId: string): void {
    if (!this.firebase.isConfigured) return;
    void this.firebase
      .getFirestore()
      .then(async (firestore) => {
        if (!firestore || this.userId !== userId) return;
        const { doc, onSnapshot } = await import('firebase/firestore');
        this.unsubscribe = onSnapshot(
          doc(firestore, 'users', userId, 'income', 'streams'),
          { includeMetadataChanges: true },
          (snapshot) => {
            if (this.userId !== userId) return;
            if (snapshot.exists()) {
              if (this.syncPending) return;
              const value: unknown = snapshot.data()['streams'];
              if (!Array.isArray(value)) return;
              const streams = this.normalizeStreams(value);
              this.streams.set(streams);
              this.persistStreams(streams, this.storageKey(userId));
            } else if (!snapshot.metadata.fromCache && this.streams().length) {
              this.syncPending = true;
              void this.syncStreams();
            }
          },
          (error) => console.error('Income stream Firestore listen failed:', error),
        );
      })
      .catch((error) => console.error('Income stream Firestore listen failed:', error));
  }

  private normalizeStreams(value: unknown[]): IncomeStream[] {
    return value
      .filter((item): item is IncomeStream => {
        if (typeof item !== 'object' || item === null) return false;
        const stream = item as Partial<IncomeStream>;
        return (
          typeof stream.id === 'string' &&
          typeof stream.name === 'string' &&
          typeof stream.type === 'string' &&
          typeof stream.amount === 'number' &&
          Number.isFinite(stream.amount) &&
          typeof stream.date === 'string' &&
          typeof stream.repeatsMonthly === 'boolean' &&
          typeof stream.createdAt === 'string'
        );
      })
      .map((stream) => ({
        ...stream,
        date: normalizeDateToIsoUtc(stream.date),
        createdAt: normalizeDateToIsoUtc(stream.createdAt),
      }));
  }

  private async syncStreams(): Promise<void> {
    const userId = this.userId;
    if (!userId || !this.syncPending || this.syncInProgress || !this.firebase.isConfigured || !this.firebase.isOnline())
      return;

    const streams = this.streams();
    const revision = this.revision;
    this.syncInProgress = true;
    try {
      const firestore = await this.firebase.getFirestore();
      if (!firestore || this.userId !== userId) return;
      const { doc, setDoc } = await import('firebase/firestore');
      await setDoc(doc(firestore, 'users', userId, 'income', 'streams'), { streams });
      if (this.userId === userId && this.revision === revision) this.syncPending = false;
    } catch (error) {
      console.error('Income stream Firestore sync failed:', error);
      this.scheduleRetry();
    } finally {
      this.syncInProgress = false;
      if (this.userId !== userId || (this.syncPending && this.revision !== revision)) {
        void this.syncStreams();
      }
    }
  }

  private scheduleRetry(): void {
    if (this.retryTimer || !this.userId || !this.firebase.isOnline()) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.syncStreams();
    }, 15_000);
  }
}
