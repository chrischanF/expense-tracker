export interface RecurringTransaction {
  id: string;
  name: string;
  amount: number;
  currency?: string;
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
  monthlyContribution?: number;
  targetDate: string;
  createdAt: string;
}

export type BudgetStatus = 'healthy' | 'watch' | 'over';

export interface UpcomingBill {
  id: string;
  name: string;
  amount: number;
  currency?: string;
  category: string;
  dueDate: string;
  daysUntilDue: number;
}

export interface SafeToSpendPlan {
  remaining: number;
  daily: number;
  weekly: number;
  daysRemaining: number;
}

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

export function calculateSafeToSpend(
  monthlyIncome: number,
  recordedSpending: number,
  upcomingBills: number,
  monthlySavings: number,
  today = new Date(),
): SafeToSpendPlan {
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysRemaining = Math.max(1, daysInMonth - today.getDate() + 1);
  const remaining = Math.max(0, monthlyIncome - recordedSpending - upcomingBills - monthlySavings);
  const daily = remaining / daysRemaining;
  return { remaining, daily, weekly: Math.min(remaining, daily * 7), daysRemaining };
}

export function getUpcomingBills(
  recurring: RecurringTransaction[],
  today = new Date(),
  daysAhead = 7,
): UpcomingBill[] {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return recurring
    .filter((item) => item.active)
    .map((item) => {
      let due = new Date(today.getFullYear(), today.getMonth(), 1);
      due.setDate(Math.min(item.dueDay, new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()));
      if (due < start) {
        due = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        due.setDate(Math.min(item.dueDay, new Date(due.getFullYear(), due.getMonth() + 1, 0).getDate()));
      }
      const daysUntilDue = Math.round((due.getTime() - start.getTime()) / 86_400_000);
      return {
        id: item.id,
        name: item.name,
        amount: item.amount,
        currency: item.currency,
        category: item.category,
        dueDate: `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`,
        daysUntilDue,
      };
    })
    .filter((bill) => bill.daysUntilDue >= 0 && bill.daysUntilDue <= daysAhead)
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue || a.name.localeCompare(b.name));
}