import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

export type ColorTheme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class AppPreferencesService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly theme = signal<ColorTheme>(this.readTheme());
  readonly currency = signal(this.readCurrency());
  readonly currencyOptions = this.getCurrencyList();

  constructor() {
    this.applyTheme(this.theme());
  }

  toggleTheme(): void {
    this.theme.update((theme) => theme === 'dark' ? 'light' : 'dark');
    this.applyTheme(this.theme());
    this.persist('expense-tracker.theme', this.theme());
  }

  setCurrency(currency: string): void {
    if (!this.currencyOptions.includes(currency)) {
      return;
    }

    this.currency.set(currency);
    this.persist('expense-tracker.selected-currency', currency);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: this.currency(),
      maximumFractionDigits: 2,
    }).format(value);
  }

  private readTheme(): ColorTheme {
    const stored = this.readStoredValue('expense-tracker.theme');
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }

    return this.isBrowser && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private readCurrency(): string {
    const stored = this.readStoredValue('expense-tracker.selected-currency');
    return stored && this.getCurrencyList().includes(stored) ? stored : 'USD';
  }

  private readStoredValue(key: string): string | null {
    if (!this.isBrowser) {
      return null;
    }

    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private persist(key: string, value: string): void {
    if (!this.isBrowser) {
      return;
    }

    try {
      localStorage.setItem(key, value);
    } catch {}
  }

  private applyTheme(theme: ColorTheme): void {
    if (this.isBrowser) {
      document.documentElement.dataset['theme'] = theme;
    }
  }

  private getCurrencyList(): string[] {
    const values = typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl
      ? Intl.supportedValuesOf('currency')
      : ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'BRL', 'MXN', 'ZAR', 'SEK', 'NOK', 'DKK', 'PLN', 'RON', 'AED', 'SGD', 'HKD', 'SAR', 'NGN', 'EGP', 'KES', 'RSD'];

    return [...new Set(values)].sort();
  }
}
