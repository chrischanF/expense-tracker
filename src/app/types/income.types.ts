export type IncomeFrequency = 'weekly' | 'biweekly' | 'twice-monthly' | 'monthly';

export interface PayPeriod {
  id?: string;
  startDate: string;
  endDate: string;
  amount: number;
}

export interface IncomeProfile {
  amount: number;
  payAmounts?: number[];
  frequency: IncomeFrequency;
  nextPayDate: string;
  payPeriods?: PayPeriod[];
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
