import { describe, expect, it } from 'vitest';
import { ReceiptParserService } from './receipt-parser.service';

describe('ReceiptParserService', () => {
  const parser = new ReceiptParserService();

  it('parses a shorthand expense into an editable draft', () => {
    expect(parser.parseText('Coffee for 150 pesos at Starbucks')).toEqual({
      amount: 150,
      merchant: 'Starbucks',
      category: 'Food',
      currency: 'MXN',
    });
  });

  it('prefers the receipt total and identifies a merchant from receipt lines', () => {
    const result = parser.parseText('Corner Cafe\nSubtotal $8.50\nTax $0.70\nTotal $9.20');
    expect(result.amount).toBe(9.2);
    expect(result.merchant).toBe('Corner Cafe');
    expect(result.currency).toBe('USD');
  });
});