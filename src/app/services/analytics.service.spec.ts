import { describe, expect, it } from 'vitest';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  it('detects the peak spending day and month from a set of expenses', () => {
    const service = new AnalyticsService();
    const expenses = [
      { id: '1', amount: 25, category: 'Food', date: '2026-10-03T09:00:00.000Z', note: 'Lunch', createdAt: '2026-10-03T09:00:00.000Z' },
      { id: '2', amount: 80, category: 'Travel', date: '2026-10-03T12:00:00.000Z', note: 'Train', createdAt: '2026-10-03T12:00:00.000Z' },
      { id: '3', amount: 120, category: 'Housing', date: '2026-10-15T12:00:00.000Z', note: 'Rent', createdAt: '2026-10-15T12:00:00.000Z' },
      { id: '4', amount: 45, category: 'Food', date: '2026-10-15T18:00:00.000Z', note: 'Dinner', createdAt: '2026-10-15T18:00:00.000Z' },
      { id: '5', amount: 300, category: 'Bills', date: '2026-09-05T08:00:00.000Z', note: 'Internet', createdAt: '2026-09-05T08:00:00.000Z' }
    ] as any;

    const summary = service.summarize(expenses);

    expect(summary.peakDay.label).toBe('2026-09-05');
    expect(summary.peakDay.total).toBe(300);
    expect(summary.peakMonth.label).toBe('2026-09');
    expect(summary.peakMonth.total).toBe(300);
    expect(summary.total).toBe(570);
  });
});
