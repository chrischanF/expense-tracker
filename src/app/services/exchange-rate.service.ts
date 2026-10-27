import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { AppPreferencesService } from './app-preferences.service';
import type { CachedRates, ExchangeRateResponse } from '../types/exchange-rate.types';

export function convertAmountToBase(
  amount: number,
  transactionCurrency: string,
  baseCurrency: string,
  rates: Record<string, number>,
): number | null {
  if (transactionCurrency === baseCurrency) return amount;
  const rate = rates[transactionCurrency];
  return rate && rate > 0 ? amount / rate : null;
}

@Injectable({ providedIn: 'root' })
export class ExchangeRateService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private requestedBase = '';
  readonly rates = signal<Record<string, number>>({});
  readonly ratesUpdatedAt = signal<number | null>(null);
  readonly isLoading = signal(false);
  readonly error = signal('');

  constructor(private readonly preferences: AppPreferencesService) {
    effect(() => {
      const base = this.preferences.currency();
      if (this.isBrowser && this.requestedBase !== base) {
        this.requestedBase = base;
        void this.refresh(base);
      }
    });
  }

  toBase(amount: number, transactionCurrency: string): number | null {
    return convertAmountToBase(amount, transactionCurrency, this.preferences.currency(), this.rates());
  }

  rateToBase(transactionCurrency: string): number | null {
    const base = this.preferences.currency();
    if (transactionCurrency === base) return 1;
    const rate = this.rates()[transactionCurrency];
    return rate && rate > 0 ? 1 / rate : null;
  }

  private async refresh(base: string): Promise<void> {
    const cached = this.readCache(base);
    this.error.set('');
    if (cached) {
      this.rates.set(cached.rates);
      this.ratesUpdatedAt.set(cached.updatedAt);
    } else {
      this.rates.set({});
      this.ratesUpdatedAt.set(null);
    }
    if (!navigator.onLine) {
      if (!cached) this.error.set('Live exchange rates are unavailable. Original amounts are still saved.');
      return;
    }

    this.isLoading.set(true);
    this.error.set('');
    try {
      const response = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`);
      if (!response.ok) throw new Error('Exchange-rate request failed');
      const data = (await response.json()) as ExchangeRateResponse;
      if (data.result !== 'success' || data.base_code !== base || !data.rates) {
        throw new Error('Exchange-rate response was invalid');
      }
      if (this.requestedBase !== base) return;
      const updatedAt = data.time_last_update_unix * 1000;
      this.rates.set(data.rates);
      this.ratesUpdatedAt.set(updatedAt);
      this.writeCache({ base, rates: data.rates, updatedAt });
    } catch {
      if (!cached && this.requestedBase === base)
        this.error.set('Live exchange rates are unavailable. Original amounts are still saved.');
    } finally {
      if (this.requestedBase === base) this.isLoading.set(false);
    }
  }

  private readCache(base: string): CachedRates | null {
    try {
      const raw = localStorage.getItem(`expense-tracker.exchange-rates.${base}`);
      if (!raw) return null;
      const cached = JSON.parse(raw) as CachedRates;
      return cached.base === base && cached.rates && typeof cached.updatedAt === 'number' ? cached : null;
    } catch {
      return null;
    }
  }

  private writeCache(cached: CachedRates): void {
    try {
      localStorage.setItem(`expense-tracker.exchange-rates.${cached.base}`, JSON.stringify(cached));
    } catch {}
  }
}
