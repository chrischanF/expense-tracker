import { describe, expect, it } from 'vitest';
import {
  additionalIncomeForMonth,
  averagePayAmount,
  payAmountCount,
  payAmountsForProfile,
  toLocalDateInputValue,
  toMonthlyIncome,
} from './income.model';
import type { IncomeProfile, IncomeStream } from '../../types/income.types';

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

  it('creates one amount slot per expected payday for each frequency', () => {
    expect(payAmountCount('weekly')).toBe(4);
    expect(payAmountCount('biweekly')).toBe(2);
    expect(payAmountCount('twice-monthly')).toBe(2);
    expect(payAmountCount('monthly')).toBe(1);
  });

  it('fills legacy profiles from their saved per-payday amount', () => {
    expect(payAmountsForProfile({ amount: 1250, frequency: 'biweekly', nextPayDate: '' })).toEqual([1250, 1250]);
  });

  it('normalizes variable paychecks using their average amount', () => {
    const profile: IncomeProfile = {
      amount: 0,
      payAmounts: [1000, 1200, 1100, 1300],
      frequency: 'weekly',
      nextPayDate: '2026-10-30',
    };
    expect(averagePayAmount(profile.payAmounts ?? [])).toBe(1150);
    expect(toMonthlyIncome(profile)).toBeCloseTo((1150 * 52) / 12);
  });

  it('formats the calendar day for a date input in local time', () => {
    expect(toLocalDateInputValue(new Date(2026, 9, 27, 0, 30))).toBe('2026-10-27');
  });
});

describe('additionalIncomeForMonth', () => {
  const streams: IncomeStream[] = [
    {
      id: 'monthly',
      name: 'Freelance',
      type: 'Freelance',
      amount: 600,
      date: '2026-08-15',
      repeatsMonthly: true,
      createdAt: '',
    },
    {
      id: 'bonus',
      name: 'Bonus',
      type: 'Bonus',
      amount: 250,
      date: '2026-10-10',
      repeatsMonthly: false,
      createdAt: '',
    },
    {
      id: 'future',
      name: 'Future sale',
      type: 'Asset sale',
      amount: 900,
      date: '2026-11-02',
      repeatsMonthly: false,
      createdAt: '',
    },
  ];

  it('includes active monthly streams and one-time income dated in that month', () => {
    expect(additionalIncomeForMonth(streams, new Date(2026, 9, 20))).toBe(850);
  });

  it('does not count a one-time stream outside its recorded month', () => {
    expect(additionalIncomeForMonth(streams, new Date(2026, 8, 20))).toBe(600);
  });
});
