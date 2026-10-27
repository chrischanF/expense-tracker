import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { additionalIncomeForMonth } from '../features/income/income.model';
import type { IncomeStream } from '../types/income.types';

const STORAGE_KEY = 'expense-tracker.demo-income-streams';

@Injectable({ providedIn: 'root' })
export class IncomeStreamService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly streams = signal<IncomeStream[]>(this.readStreams());
  readonly currentMonthTotal = computed(() => additionalIncomeForMonth(this.streams()));

  add(stream: Omit<IncomeStream, 'id' | 'createdAt'>): void {
    const record: IncomeStream = {
      ...stream,
      id: crypto.randomUUID(),
      name: stream.name.trim(),
      amount: Number(stream.amount),
      createdAt: new Date().toISOString(),
    };
    this.write([...this.streams(), record]);
  }

  update(stream: IncomeStream): void {
    this.write(
      this.streams().map((entry) => (entry.id === stream.id ? { ...stream, name: stream.name.trim() } : entry)),
    );
  }

  delete(id: string): void {
    this.write(this.streams().filter((entry) => entry.id !== id));
  }

  private readStreams(): IncomeStream[] {
    if (!this.isBrowser) return [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const saved: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(saved) ? (saved as IncomeStream[]) : [];
    } catch {
      return [];
    }
  }

  private write(streams: IncomeStream[]): void {
    this.streams.set(streams);
    if (!this.isBrowser) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(streams));
    } catch {}
  }
}
