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

export type PlanningCollection = 'recurring' | 'budgets' | 'goals';
export type PlanningRecord = RecurringTransaction | CategoryBudget | SavingsGoal;

export interface PendingPlanningChange {
  collection: PlanningCollection;
  id: string;
  type: 'upsert' | 'delete';
  record?: PlanningRecord;
}
