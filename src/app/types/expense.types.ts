import type { ExpenseItem } from './analytics.types';

export interface PendingExpenseChange {
  type: 'upsert' | 'delete';
  expense?: ExpenseItem;
}
