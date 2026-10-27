import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { payPeriodForDate } from '../features/income/income.model';
import { ExpenseService } from './expense.service';
import type { IncomeStream, PayPeriod } from '../types/income.types';
import { toLocalDateInputValue } from '../utils/date-normalization';

export const ALL_PAY_PERIODS_KEY = 'all-periods';

@Injectable({ providedIn: 'root' })
export class PayPeriodFilterService {
  private readonly expenses = inject(ExpenseService);

  readonly selectedKey = signal<string | null>(null);
  readonly options = computed(() =>
    [...(this.expenses.incomeProfile().payPeriods ?? [])]
      .sort((left, right) => right.startDate.localeCompare(left.startDate))
      .map((period) => ({ period, key: this.keyFor(period) })),
  );
  readonly selectedPeriod = computed(
    () => this.options().find((option) => option.key === this.selectedKey())?.period ?? null,
  );

  constructor() {
    effect(() => {
      const options = this.options();
      const key = this.selectedKey();
      if (!options.length) {
        if (key !== null && key !== ALL_PAY_PERIODS_KEY) this.selectedKey.set(ALL_PAY_PERIODS_KEY);
        return;
      }
      if (key === ALL_PAY_PERIODS_KEY || options.some((option) => option.key === key)) return;

      const current = options.find((option) => payPeriodForDate([option.period]) !== null);
      const fallbackKey = current?.key ?? options[0].key;
      this.selectedKey.set(fallbackKey);
    });
  }

  select(key: string): void {
    this.selectedKey.set(key || ALL_PAY_PERIODS_KEY);
  }

  keyFor(period: PayPeriod): string {
    return period.id ?? toLocalDateInputValue(period.startDate);
  }

  formatPeriod(period: PayPeriod): string {
    return `${toLocalDateInputValue(period.startDate)} to ${toLocalDateInputValue(period.endDate)}`;
  }

  filterExpenses<T extends { date: string }>(expenses: T[]): T[] {
    const period = this.selectedPeriod();
    if (!period) return expenses;
    const startDate = toLocalDateInputValue(period.startDate);
    const endDate = toLocalDateInputValue(period.endDate);
    return expenses.filter((expense) => {
      const date = toLocalDateInputValue(expense.date);
      return date >= startDate && date <= endDate;
    });
  }

  filterPayPeriods(periods: PayPeriod[]): PayPeriod[] {
    const selected = this.selectedPeriod();
    if (!selected) return periods;
    const startDate = toLocalDateInputValue(selected.startDate);
    const endDate = toLocalDateInputValue(selected.endDate);
    return periods.filter((period) => {
      const periodStart = toLocalDateInputValue(period.startDate);
      const periodEnd = toLocalDateInputValue(period.endDate);
      return periodStart <= endDate && periodEnd >= startDate;
    });
  }

  filterIncomeStreams(streams: IncomeStream[]): IncomeStream[] {
    const selected = this.selectedPeriod();
    if (!selected) return streams;
    const startDate = toLocalDateInputValue(selected.startDate);
    const endDate = toLocalDateInputValue(selected.endDate);
    return streams.filter((stream) => {
      const date = toLocalDateInputValue(stream.date);
      return stream.repeatsMonthly ? date <= endDate : date >= startDate && date <= endDate;
    });
  }
}
