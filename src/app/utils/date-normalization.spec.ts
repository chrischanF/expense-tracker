import { describe, expect, it } from 'vitest';
import { normalizeDateToIsoUtc, toLocalDateInputValue } from './date-normalization';

describe('date normalization', () => {
  it('stores a local date-input day as an ISO timestamp that round-trips to the same local day', () => {
    const isoDate = normalizeDateToIsoUtc('2026-10-27');

    expect(isoDate.endsWith('Z')).toBe(true);
    expect(toLocalDateInputValue(isoDate)).toBe('2026-10-27');
  });

  it('normalizes timestamps to canonical ISO UTC strings', () => {
    expect(normalizeDateToIsoUtc('2026-10-27T15:45:00-04:00')).toBe('2026-10-27T19:45:00.000Z');
  });

  it('rejects invalid date-input days', () => {
    expect(() => normalizeDateToIsoUtc('2026-02-31')).toThrow(RangeError);
  });
});
