import type { IncomeFrequency, IncomeProfile, IncomeStream } from '../../types/income.types';
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
