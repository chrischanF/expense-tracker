import { describe, expect, it } from 'vitest';
import { convertAmountToBase } from './exchange-rate.service';

describe('convertAmountToBase', () => {
  it('converts an entered amount using base-currency rates', () => {
    expect(convertAmountToBase(170, 'MXN', 'USD', { MXN: 17 })).toBe(10);
  });

  it('keeps base-currency amounts unchanged and reports missing rates', () => {
    expect(convertAmountToBase(25, 'USD', 'USD', {})).toBe(25);
    expect(convertAmountToBase(25, 'EUR', 'USD', {})).toBeNull();
  });
});