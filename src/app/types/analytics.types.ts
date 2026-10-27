export interface ExpenseItem {
  id: string;
  amount: number;
  category: string;
  source: string;
  date: string;
  note: string;
  createdAt: string;
  currency?: string;
  merchant?: string;
  recurringId?: string;
  recurringMonth?: string;
}

export interface AnalyticsPoint {
  label: string;
  total: number;
  count: number;
}

export interface AnalyticsSummary {
  total: number;
  peakDay: AnalyticsPoint;
  peakMonth: AnalyticsPoint;
  byCategory: Record<string, number>;
  dailyBreakdown: AnalyticsPoint[];
  monthlyBreakdown: AnalyticsPoint[];
}
