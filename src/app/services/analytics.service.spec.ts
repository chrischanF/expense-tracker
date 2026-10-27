import { describe, expect, it } from 'vitest';
import { AnalyticsService } from './analytics.service';
import type { ExpenseItem } from '../types/analytics.types';

describe('AnalyticsService', () => {
  it('detects the peak spending day and month from a set of expenses', () => {
    const service = new AnalyticsService();
    const expenses = [
      {
        id: '1',
        amount: 25,
        category: 'Food',
        source: 'Cash',
        date: '2026-10-03T09:00:00.000Z',
        note: 'Lunch',
        createdAt: '2026-10-03T09:00:00.000Z',
      },
      {
        id: '2',
        amount: 80,
        category: 'Travel',
        source: 'Credit Card',
        date: '2026-10-03T12:00:00.000Z',
        note: 'Train',
        createdAt: '2026-10-03T12:00:00.000Z',
      },
      {
        id: '3',
        amount: 120,
        category: 'Housing',
        source: 'Bank Transfer',
        date: '2026-10-15T12:00:00.000Z',
        note: 'Rent',
        createdAt: '2026-10-15T12:00:00.000Z',
      },
      {
        id: '4',
        amount: 45,
        category: 'Food',
        source: 'Cash',
        date: '2026-10-15T18:00:00.000Z',
        note: 'Dinner',
        createdAt: '2026-10-15T18:00:00.000Z',
      },
      {
        id: '5',
        amount: 300,
        category: 'Bills',
        source: 'Debit Card',
        date: '2026-09-05T08:00:00.000Z',
        note: 'Internet',
        createdAt: '2026-09-05T08:00:00.000Z',
      },
    ] as any;

    const summary = service.summarize(expenses);

    expect(summary.peakDay.label).toBe('2026-09-05');
    expect(summary.peakDay.total).toBe(300);
    expect(summary.peakMonth.label).toBe('2026-09');
    expect(summary.peakMonth.total).toBe(300);
    expect(summary.total).toBe(570);
  });

  it('filters expenses by source and treats legacy records as Other', () => {
    const service = new AnalyticsService();
    const expenses: ExpenseItem[] = [
      {
        id: '1',
        amount: 25,
        category: 'Food',
        source: 'Cash',
        date: '2026-10-03T09:00:00.000Z',
        note: '',
        createdAt: '2026-10-03T09:00:00.000Z',
      },
      {
        id: '2',
        amount: 80,
        category: 'Food',
        source: 'Credit Card',
        date: '2026-10-04T09:00:00.000Z',
        note: '',
        createdAt: '2026-10-04T09:00:00.000Z',
      },
      {
        id: '3',
        amount: 12,
        category: 'Other',
        date: '2026-10-05T09:00:00.000Z',
        note: '',
        createdAt: '2026-10-05T09:00:00.000Z',
      } as ExpenseItem,
    ];

    expect(service.filterBySource(expenses, 'Cash').map((expense) => expense.id)).toEqual(['1']);
    expect(service.filterBySource(expenses, 'Other').map((expense) => expense.id)).toEqual(['3']);
    expect(service.filterBySource(expenses, 'all')).toEqual(expenses);
  });

  it('fills missing dates in daily trend data', () => {
    const service = new AnalyticsService();
    const expenses: ExpenseItem[] = [
      {
        id: '1',
        amount: 25,
        category: 'Food',
        source: 'Cash',
        date: '2026-10-29T12:00:00.000Z',
        note: '',
        createdAt: '',
      },
    ];
    const trend = service.dailyTrend(expenses, new Date(2026, 9, 30, 12), 3);

    expect(trend.map((point) => point.label)).toEqual(['2026-10-28', '2026-10-29', '2026-10-30']);
    expect(trend.map((point) => point.total)).toEqual([0, 25, 0]);
  });

  it('returns a complete twelve-month trend with zero-value months', () => {
    const service = new AnalyticsService();
    const trend = service.monthlyTrend([], new Date(2026, 9, 30, 12));

    expect(trend).toHaveLength(12);
    expect(trend[0].label).toBe('2025-11');
    expect(trend[11].label).toBe('2026-10');
  });
});
