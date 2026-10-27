export interface RecurringTransaction {
  id: string;
  name: string;
  amount: number;
  category: string;
  source: string;
  dueDay: number;
  active: boolean;
  createdAt: string;
}

export interface CategoryBudget {
  id: string;
  category: string;
  monthlyLimit: number;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  targetDate: string;
  createdAt: string;
}

export type BudgetStatus = 'healthy' | 'watch' | 'over';

export const EXPENSE_CATEGORIES = ['Food', 'Transport', 'Housing', 'Bills', 'Shopping', 'Other'] as const;

export function getBudgetStatus(spent: number, limit: number): BudgetStatus {
  if (limit > 0 && spent >= limit) {
    return 'over';
  }
  return limit > 0 && spent / limit >= 0.8 ? 'watch' : 'healthy';
}

export function recurringDateForMonth(year: number, month: number, dueDay: number): string {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(Math.max(1, Math.floor(dueDay)), lastDay);
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00.000Z`;
}