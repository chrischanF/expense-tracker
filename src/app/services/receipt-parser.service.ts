import { Injectable } from '@angular/core';

export interface ParsedExpenseDraft {
  amount: number | null;
  merchant: string;
  category: string;
  currency: string | null;
}

@Injectable({ providedIn: 'root' })
export class ReceiptParserService {
  parseText(text: string): ParsedExpenseDraft {
    const lines = text.split(/[\r\n]+/).map((line) => line.trim()).filter(Boolean);
    const totalLine = lines.find((line) => /\b(total|amount due|grand total|paid)\b/i.test(line));
    const amount = this.parseAmount(totalLine ?? text);
    const merchant = this.parseMerchant(lines, text);
    const normalized = text.toLowerCase();
    const category = /coffee|restaurant|grocery|market|food|cafe|café|lunch|dinner|bakery/.test(normalized)
      ? 'Food'
      : /fuel|gas station|parking|taxi|uber|transit|train|bus/.test(normalized)
        ? 'Transport'
        : /rent|landlord|mortgage/.test(normalized)
          ? 'Housing'
          : /electric|water bill|internet|utility|subscription|phone bill/.test(normalized)
            ? 'Bills'
            : 'Other';

    return { amount, merchant, category, currency: this.parseCurrency(text) };
  }

  async parseImage(file: File): Promise<ParsedExpenseDraft> {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng');
    try {
      const { data } = await worker.recognize(file);
      return this.parseText(data.text);
    } finally {
      await worker.terminate();
    }
  }

  private parseAmount(text: string): number | null {
    const match = text.match(/(?:[$€£¥₹₱]\s*|\b(?:USD|EUR|GBP|JPY|INR|MXN|CAD|AUD)\s*)?(\d[\d,]*(?:\.\d{1,2})?)/i);
    if (!match) return null;
    const value = Number(match[1].replaceAll(',', ''));
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  private parseMerchant(lines: string[], text: string): string {
    const spoken = text.match(/\b(?:at|from|@)\s+([^,\n]+?)(?:\s+(?:for|costs?|total(?:ing)?)\b|[,\n]|$)/i);
    if (spoken?.[1]) return spoken[1].trim().replace(/[.]+$/, '');
    const candidate = lines.find((line) =>
      !/\b(total|subtotal|tax|change|cash|visa|mastercard|receipt|invoice|date|time|thank you)\b/i.test(line)
      && !/^[$€£¥₹₱\d]/.test(line)
      && line.length >= 2,
    );
    return candidate?.replace(/\s{2,}/g, ' ') ?? '';
  }

  private parseCurrency(text: string): string | null {
    const code = text.match(/\b(USD|EUR|GBP|JPY|INR|MXN|CAD|AUD|CHF|CNY|BRL|PHP)\b/i);
    if (code) return code[1].toUpperCase();
    if (/\bpesos?\b/i.test(text)) return 'MXN';
    if (/\bdollars?\b/i.test(text) || text.includes('$')) return 'USD';
    if (text.includes('€')) return 'EUR';
    if (text.includes('£')) return 'GBP';
    if (text.includes('¥')) return 'JPY';
    if (text.includes('₹')) return 'INR';
    if (text.includes('₱')) return 'PHP';
    return null;
  }
}