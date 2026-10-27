export type IncomeFrequency = 'weekly' | 'biweekly' | 'twice-monthly' | 'monthly';

export interface IncomeProfile {
  amount: number;
  payAmounts?: number[];
  frequency: IncomeFrequency;
  nextPayDate: string;
}

export interface IncomeStream {
  id: string;
  name: string;
  type: string;
  amount: number;
  date: string;
  repeatsMonthly: boolean;
  createdAt: string;
}
