import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import type { ChartData, ChartOptions } from 'chart.js';
import { AnalyticsService } from '../../services/analytics.service';
import { AppPreferencesService } from '../../services/app-preferences.service';
import { ExpenseService } from '../../services/expense.service';
import { ExchangeRateService } from '../../services/exchange-rate.service';
import { DropdownComponent } from '../../shared/dropdown/dropdown.component';
import type { DropdownOption } from '../../types/dropdown.types';

@Component({
  selector: 'app-analytics-page',
  imports: [BaseChartDirective, DropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './analytics.page.html',
  styleUrl: './analytics.page.scss',
})
export class AnalyticsPage {
  private readonly expenseService = inject(ExpenseService);
  private readonly analytics = inject(AnalyticsService);
  private readonly preferences = inject(AppPreferencesService);
  readonly exchangeRates = inject(ExchangeRateService);

  private readonly palette = ['#168878', '#e3a23b', '#607f9b', '#d9755e', '#81a94c', '#9b7bb5'];
  readonly sourceFilter = signal('all');
  readonly trendRange = signal<'30d' | 'year'>('30d');
  readonly trendRangeOptions: DropdownOption[] = [
    { value: '30d', label: 'Last 30 days' },
    { value: 'year', label: 'Last 12 months' },
  ];
  readonly sourceOptions = computed(() =>
    [...new Set(this.expenseService.expenses().map((expense) => expense.source || 'Other'))].sort((a, b) =>
      a.localeCompare(b),
    ),
  );
  readonly sourceFilterOptions = computed<DropdownOption[]>(() => [
    { value: 'all', label: 'All sources' },
    ...this.sourceOptions().map((source) => ({ value: source, label: source })),
  ]);
  private readonly baseExpenses = computed(() =>
    this.expenseService
      .expenses()
      .map((expense) => ({
        expense,
        amount: this.exchangeRates.toBase(expense.amount, expense.currency || this.preferences.currency()),
      }))
      .filter((entry) => entry.amount !== null)
      .map(({ expense, amount }) => ({ ...expense, amount: amount ?? 0 })),
  );
  private readonly filteredExpenses = computed(() =>
    this.analytics.filterBySource(this.baseExpenses(), this.sourceFilter()),
  );
  private readonly summary = computed(() => this.analytics.summarize(this.filteredExpenses()));
  readonly peakDay = computed(() => this.summary().peakDay);
  readonly peakMonth = computed(() => this.summary().peakMonth);
  readonly totalSpent = computed(() => this.summary().total);
  readonly categoryChartData = computed<ChartData<'pie'>>(() => {
    const categories = this.summary().byCategory;
    const labels = Object.keys(categories);
    return {
      labels: labels.length ? labels : ['No expenses'],
      datasets: [
        {
          data: labels.length ? Object.values(categories) : [1],
          backgroundColor: this.palette,
          borderWidth: 0,
        },
      ],
    };
  });
  readonly trendChartData = computed<ChartData<'line'>>(() => {
    const points =
      this.trendRange() === '30d'
        ? this.analytics.dailyTrend(this.filteredExpenses())
        : this.analytics.monthlyTrend(this.filteredExpenses());
    return {
      labels: points.map((point) => this.trendLabel(point.label)),
      datasets: [
        {
          label: 'Spend',
          data: points.map((point) => point.total),
          borderColor: '#168878',
          backgroundColor:
            this.preferences.theme() === 'dark' ? 'rgba(91, 196, 167, 0.16)' : 'rgba(22, 136, 120, 0.12)',
          pointBackgroundColor: '#168878',
          pointRadius: this.trendRange() === '30d' ? 1.5 : 3,
          pointHoverRadius: 5,
          fill: true,
          tension: 0.32,
        },
      ],
    };
  });
  readonly categoryChartOptions = computed<ChartOptions<'pie'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { color: this.chartTextColor() } } },
  }));
  readonly trendChartOptions = computed<ChartOptions<'line'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { color: this.chartTextColor(), callback: (value) => this.preferences.formatCurrency(Number(value)) },
        grid: { color: this.chartGridColor() },
      },
      x: {
        ticks: { color: this.chartTextColor(), maxTicksLimit: this.trendRange() === '30d' ? 7 : 12 },
        grid: { display: false },
      },
    },
  }));

  formatCurrency(value: number): string {
    return this.preferences.formatCurrency(value);
  }

  private chartTextColor(): string {
    return this.preferences.theme() === 'dark' ? '#b9c9c1' : '#68766f';
  }

  private chartGridColor(): string {
    return this.preferences.theme() === 'dark' ? 'rgba(185, 201, 193, 0.12)' : 'rgba(55, 74, 65, 0.1)';
  }

  private trendLabel(value: string): string {
    const date = new Date(`${value}${value.length === 7 ? '-01' : ''}T12:00:00`);
    return new Intl.DateTimeFormat(
      undefined,
      this.trendRange() === '30d' ? { month: 'short', day: 'numeric' } : { month: 'short', year: '2-digit' },
    ).format(date);
  }
}
