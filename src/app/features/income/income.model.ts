import type { IncomeFrequency, IncomeProfile, IncomeStream, PayPeriod } from '../../types/income.types';
import { toLocalDateInputValue } from '../../utils/date-normalization';

export type { IncomeFrequency, IncomeProfile, IncomeStream } from '../../types/income.types';
export { toLocalDateInputValue } from '../../utils/date-normalization';

const PAY_PERIODS_PER_YEAR: Record<IncomeFrequency, number> = {
  weekly: 52,
  biweekly: 26,
  'twice-monthly': 24,
  monthly: 12,
};

const PAY_AMOUNTS_PER_MONTH: Record<IncomeFrequency, number> = {
  weekly: 4,
  biweekly: 2,
  'twice-monthly': 2,
  monthly: 1,
};

export function payAmountCount(frequency: IncomeFrequency): number {
  return PAY_AMOUNTS_PER_MONTH[frequency];
}

export function payAmountsForProfile(profile: IncomeProfile): number[] {
  const count = payAmountCount(profile.frequency);
  const amounts = profile.payAmounts?.slice(0, count) ?? [];
  const average = Number(profile.amount) || 0;
  return Array.from({ length: count }, (_, index) => {
    const amount = Number(amounts[index]);
    return Number.isFinite(amount) && amount >= 0 ? amount : average;
  });
}

export function payPeriodForCurrentMonth(profile: IncomeProfile, month = new Date()): PayPeriod | null {
  const monthStart = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd = toLocalDateInputValue(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  const savedPeriods = (profile.payPeriods ?? [])
    .map((period) => ({
      ...period,
      startDate: toLocalDateInputValue(period.startDate),
      endDate: toLocalDateInputValue(period.endDate),
    }))
    .filter((period) => period.startDate <= monthEnd && period.endDate >= monthStart)
    .sort((left, right) => left.startDate.localeCompare(right.startDate));
  const dateInput = toLocalDateInputValue(month);
  return (
    savedPeriods.find((period) => period.startDate <= dateInput && period.endDate >= dateInput) ??
    savedPeriods.at(-1) ??
    null
  );
}

export function mergePayPeriodHistory(existing: PayPeriod[], saved: PayPeriod[]): PayPeriod[] {
  const keyFor = (period: PayPeriod) => period.id ?? toLocalDateInputValue(period.startDate);
  const periods = new Map(existing.map((period) => [keyFor(period), period]));
  for (const period of saved) {
    periods.set(keyFor(period), period);
  }
  return [...periods.values()].sort((left, right) => left.startDate.localeCompare(right.startDate));
}

export function payPeriodForDate(periods: PayPeriod[], date = new Date()): PayPeriod | null {
  const dateInput = toLocalDateInputValue(date);
  return (
    periods
      .filter((period) => {
        const startDate = toLocalDateInputValue(period.startDate);
        const endDate = toLocalDateInputValue(period.endDate);
        return startDate <= dateInput && endDate >= dateInput;
      })
      .sort((left, right) => right.startDate.localeCompare(left.startDate))[0] ?? null
  );
}

export function averagePayAmount(amounts: number[]): number {
  const validAmounts = amounts.map(Number).filter((amount) => Number.isFinite(amount) && amount >= 0);
  return validAmounts.length ? validAmounts.reduce((total, amount) => total + amount, 0) / validAmounts.length : 0;
}

export function additionalIncomeForMonth(streams: IncomeStream[], month = new Date()): number {
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999);
  return streams.reduce((total, stream) => {
    const dateInput = toLocalDateInputValue(stream.date);
    const startDate = dateInput ? new Date(`${dateInput}T00:00:00`) : new Date(Number.NaN);
    if (Number.isNaN(startDate.getTime()) || startDate > monthEnd) return total;
    if (stream.repeatsMonthly || (startDate >= monthStart && startDate <= monthEnd)) {
      return total + (Number(stream.amount) > 0 ? Number(stream.amount) : 0);
    }
    return total;
  }, 0);
}

export function toMonthlyIncome(profile: IncomeProfile): number {
  const amount = profile.payAmounts?.length ? averagePayAmount(payAmountsForProfile(profile)) : Number(profile.amount);
  return Number.isFinite(amount) && amount > 0 ? (amount * PAY_PERIODS_PER_YEAR[profile.frequency]) / 12 : 0;
}
