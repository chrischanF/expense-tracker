import { describe, expect, it } from 'vitest';
import { getBudgetStatus, recurringDateForMonth } from './planning.model';

describe('planning model', () => {
  it('classifies budget usage at the watch and over-limit thresholds', () => {
    expect(getBudgetStatus(79, 100)).toBe('healthy');
    expect(getBudgetStatus(80, 100)).toBe('watch');
    expect(getBudgetStatus(100, 100)).toBe('over');
    expect(getBudgetStatus(100, 0)).toBe('healthy');
  });

  it('clamps a recurring due day to the last day of the month', () => {
    expect(recurringDateForMonth(2026, 1, 31)).toBe('2026-02-28T12:00:00.000Z');
    expect(recurringDateForMonth(2028, 1, 31)).toBe('2028-02-29T12:00:00.000Z');
  });
});