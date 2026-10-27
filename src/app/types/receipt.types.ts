export interface ParsedExpenseDraft {
  amount: number | null;
  merchant: string;
  category: string;
  currency: string | null;
}
