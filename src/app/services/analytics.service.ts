export interface ExpenseItem {
  id: string;
  amount: number;
  category: string;
  date: string;
  note: string;
  createdAt: string;
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

export class AnalyticsService {
  summarize(expenses: ExpenseItem[]): AnalyticsSummary {
    const totalsByDay = new Map<string, number>();
    const totalsByMonth = new Map<string, number>();
    const totalsByCategory = new Map<string, number>();
    const dailyCount = new Map<string, number>();
    const monthlyCount = new Map<string, number>();
    let total = 0;

    for (const expense of expenses) {
      const amount = Number(expense.amount) || 0;
      const timeStamp = new Date(expense.date);

      if (Number.isNaN(timeStamp.getTime())) {
        continue;
      }

      const dayKey = timeStamp.toISOString().slice(0, 10);
      const monthKey = timeStamp.toISOString().slice(0, 7);
      const categoryKey = expense.category || 'Other';

      totalsByDay.set(dayKey, (totalsByDay.get(dayKey) ?? 0) + amount);
      totalsByMonth.set(monthKey, (totalsByMonth.get(monthKey) ?? 0) + amount);
      totalsByCategory.set(categoryKey, (totalsByCategory.get(categoryKey) ?? 0) + amount);
      dailyCount.set(dayKey, (dailyCount.get(dayKey) ?? 0) + 1);
      monthlyCount.set(monthKey, (monthlyCount.get(monthKey) ?? 0) + 1);
      total += amount;
    }

    const dailyBreakdown = [...totalsByDay.entries()]
      .map(([label, totalAmount]) => ({ label, total: totalAmount, count: dailyCount.get(label) ?? 0 }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const monthlyBreakdown = [...totalsByMonth.entries()]
      .map(([label, totalAmount]) => ({ label, total: totalAmount, count: monthlyCount.get(label) ?? 0 }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const peakDay = dailyBreakdown.reduce<AnalyticsPoint>(
      (currentPeak, entry) => {
        if (!currentPeak.label || entry.total > currentPeak.total) {
          return { label: entry.label, total: entry.total, count: entry.count };
        }
        return currentPeak;
      },
      { label: '', total: 0, count: 0 },
    );

    const peakMonth = monthlyBreakdown.reduce<AnalyticsPoint>(
      (currentPeak, entry) => {
        if (!currentPeak.label || entry.total > currentPeak.total) {
          return { label: entry.label, total: entry.total, count: entry.count };
        }
        return currentPeak;
      },
      { label: '', total: 0, count: 0 },
    );

    return {
      total,
      peakDay: peakDay.label ? peakDay : { label: 'No data', total: 0, count: 0 },
      peakMonth: peakMonth.label ? peakMonth : { label: 'No data', total: 0, count: 0 },
      byCategory: Object.fromEntries([...totalsByCategory.entries()].sort((a, b) => b[1] - a[1])),
      dailyBreakdown,
      monthlyBreakdown,
    };
  }
}
