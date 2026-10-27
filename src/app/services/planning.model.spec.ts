import { describe, expect, it } from 'vitest';
import { calculateSafeToSpend, getBudgetStatus, getUpcomingBills, recurringDateForMonth } from './planning.model';

describe('planning model', () => {
  it('classifies budget usage at the watch and over-limit thresholds', () => {
    expect(getBudgetStatus(79, 100)).toBe('healthy');
    expect(getBudgetStatus(80, 100)).toBe('watch');
    expect(getBudgetStatus(100, 100)).toBe('over');
    expect(getBudgetStatus(100, 0)).toBe('healthy');
  });

  it('clamps a recurring due day to the last day of the month', () => {
    expect(recurringDateForMonth(2026, 1, 31)).toBe('2026-02-28');
    expect(recurringDateForMonth(2028, 1, 31)).toBe('2028-02-29');
  });

  it('reserves recorded spending, upcoming bills, and savings before setting a daily amount', () => {
    const plan = calculateSafeToSpend(3000, 900, 400, 300, new Date(2026, 9, 21));
    expect(plan.remaining).toBe(1400);
    expect(plan.daysRemaining).toBe(11);
    expect(plan.daily).toBeCloseTo(1400 / 11);
    expect(plan.weekly).toBeCloseTo((1400 / 11) * 7);
  });

  it('lists active bills due within the next week and skips paused bills', () => {
    const bills = [
      {
        id: 'rent',
        name: 'Rent',
        amount: 800,
        category: 'Housing',
        source: 'Bank Transfer',
        dueDay: 25,
        active: true,
        createdAt: '',
      },
      {
        id: 'paused',
        name: 'Service',
        amount: 15,
        category: 'Bills',
        source: 'Card',
        dueDay: 23,
        active: false,
        createdAt: '',
      },
    ];
    const upcoming = getUpcomingBills(bills, new Date(2026, 9, 21), 7);
    expect(upcoming.map((bill) => bill.id)).toEqual(['rent']);
    expect(upcoming[0].daysUntilDue).toBe(4);
  });
});
