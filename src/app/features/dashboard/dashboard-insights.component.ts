import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import type { ChartData, ChartOptions } from 'chart.js';
import { AnalyticsService } from '../../services/analytics.service';
import { AppPreferencesService } from '../../services/app-preferences.service';
import type { ExpenseItem } from '../../types/analytics.types';

interface CategorySummary {
  name: string;
  amount: number;
  share: number;
  color: string;
}

@Component({
  selector: 'app-dashboard-insights',
  imports: [BaseChartDirective, DecimalPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-insights.component.html',
  styleUrl: './dashboard-insights.component.scss',
})
export class DashboardInsightsComponent {
  private readonly analytics = inject(AnalyticsService);
  readonly preferences = inject(AppPreferencesService);
  readonly monthlyExpenses = input.required<ExpenseItem[]>();
  readonly trendExpenses = input.required<ExpenseItem[]>();
  readonly monthlyIncome = input.required<number>();
  readonly range = signal<'month' | 'six-months'>('six-months');
  private readonly palette = ['#11a77d', '#ffb13b', '#5289c7', '#e77d62', '#8e70d6', '#85958e'];
  private readonly summary = computed(() => this.analytics.summarize(this.monthlyExpenses()));
  readonly totalSpent = computed(() => this.summary().total);
  readonly savingsRate = computed(() =>
    this.monthlyIncome() > 0 ? ((this.monthlyIncome() - this.totalSpent()) / this.monthlyIncome()) * 100 : 0,
  );
  readonly allCategories = computed<CategorySummary[]>(() => {
    const entries = Object.entries(this.summary().byCategory);
    return entries.map(([name, amount], index) => ({
      name,
      amount,
      share: this.totalSpent() > 0 ? (amount / this.totalSpent()) * 100 : 0,
      color: this.palette[index % this.palette.length],
    }));
  });
  readonly categories = computed(() => this.allCategories().slice(0, 5));
  readonly categoryChartData = computed<ChartData<'doughnut'>>(() => ({
    labels: this.allCategories().map((category) => category.name),
    datasets: [
      {
        data: this.allCategories().map((category) => category.amount),
        backgroundColor: this.allCategories().map((category) => category.color),
        borderWidth: 0,
        hoverOffset: 4,
      },
    ],
  }));
  readonly categoryChartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
  };
  readonly trendPoints = computed(() => {
    const today = new Date();
    return this.range() === 'month'
      ? this.analytics.dailyTrend(this.trendExpenses(), today, 30)
      : this.analytics.monthlyTrend(this.trendExpenses(), today, 6);
  });
  readonly trendChartData = computed<ChartData<'line'>>(() => ({
    labels: this.trendPoints().map((point) => this.trendLabel(point.label)),
    datasets: [
      {
        data: this.trendPoints().map((point) => point.total),
        borderColor: '#13a981',
        backgroundColor: this.preferences.theme() === 'dark' ? 'rgba(19, 169, 129, 0.18)' : 'rgba(19, 169, 129, 0.14)',
        pointBackgroundColor: '#13a981',
        pointBorderWidth: 0,
        pointRadius: this.range() === 'month' ? 1.5 : 2.5,
        pointHoverRadius: 5,
        fill: true,
        tension: 0.36,
      },
    ],
  }));
  readonly trendChartOptions = computed<ChartOptions<'line'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: {
        beginAtZero: true,
        border: { display: false },
        ticks: {
          color: this.chartTextColor(),
          maxTicksLimit: 4,
          callback: (value) => this.preferences.formatCurrency(Number(value)),
        },
        grid: { color: this.chartGridColor() },
      },
      x: {
        border: { display: false },
        ticks: { color: this.chartTextColor(), maxTicksLimit: this.range() === 'month' ? 5 : 6 },
        grid: { display: false },
      },
    },
  }));

  formatCurrency(value: number): string {
    return this.preferences.formatCurrency(value);
  }

  private trendLabel(value: string): string {
    const date = new Date(`${value}${value.length === 7 ? '-01' : ''}T12:00:00`);
    return new Intl.DateTimeFormat(
      undefined,
      this.range() === 'month' ? { month: 'short', day: 'numeric' } : { month: 'short' },
    ).format(date);
  }

  private chartTextColor(): string {
    return this.preferences.theme() === 'dark' ? '#b9c9c1' : '#68766f';
  }

  private chartGridColor(): string {
    return this.preferences.theme() === 'dark' ? 'rgba(185, 201, 193, 0.12)' : 'rgba(55, 74, 65, 0.1)';
  }
}
