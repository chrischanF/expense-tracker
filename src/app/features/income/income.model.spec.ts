import { describe, expect, it } from 'vitest';
import { IncomeProfile, toLocalDateInputValue, toMonthlyIncome } from './income.model';

describe('toMonthlyIncome', () => {
  it.each([
    [{ amount: 1000, frequency: 'weekly', nextPayDate: '2026-10-30' }, 4333.333333333333],
    [{ amount: 2000, frequency: 'biweekly', nextPayDate: '2026-10-30' }, 4333.333333333333],
    [{ amount: 2500, frequency: 'twice-monthly', nextPayDate: '2026-10-30' }, 5000],
    [{ amount: 5000, frequency: 'monthly', nextPayDate: '2026-10-30' }, 5000],
  ] as Array<[IncomeProfile, number]>)('converts %s to a monthly baseline', (profile, expected) => {
    expect(toMonthlyIncome(profile)).toBeCloseTo(expected);
  });

  it('treats invalid and non-positive amounts as zero', () => {
    expect(toMonthlyIncome({ amount: Number.NaN, frequency: 'monthly', nextPayDate: '' })).toBe(0);
    expect(toMonthlyIncome({ amount: -100, frequency: 'weekly', nextPayDate: '' })).toBe(0);
  });

  it('formats the calendar day for a date input in local time', () => {
    expect(toLocalDateInputValue(new Date(2026, 9, 27, 0, 30))).toBe('2026-10-27');
  });
});
