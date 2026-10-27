export type IncomeFrequency = 'weekly' | 'biweekly' | 'twice-monthly' | 'monthly';

export interface IncomeProfile {
  amount: number;
  frequency: IncomeFrequency;
  nextPayDate: string;
}

const PAY_PERIODS_PER_YEAR: Record<IncomeFrequency, number> = {
  weekly: 52,
  biweekly: 26,
  'twice-monthly': 24,
  monthly: 12,
};

export function toMonthlyIncome(profile: IncomeProfile): number {
  const amount = Number(profile.amount);
  return Number.isFinite(amount) && amount > 0
    ? amount * PAY_PERIODS_PER_YEAR[profile.frequency] / 12
    : 0;
}

export function toLocalDateInputValue(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}
