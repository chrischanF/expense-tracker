import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import type { ChartData, ChartOptions } from 'chart.js';
import { AnalyticsService } from '../../services/analytics.service';
import { AppPreferencesService } from '../../services/app-preferences.service';
import { ExpenseService } from '../../services/expense.service';
import { DropdownComponent, type DropdownOption } from '../../shared/dropdown/dropdown.component';

@Component({
  selector: 'app-analytics-page',
  imports: [BaseChartDirective, FormsModule, DropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './analytics.page.html',
})
export class AnalyticsPage {
  private readonly expenseService = inject(ExpenseService);
  private readonly analytics = inject(AnalyticsService);
  private readonly preferences = inject(AppPreferencesService);

  private readonly palette = ['#168878', '#e3a23b', '#607f9b', '#d9755e', '#81a94c', '#9b7bb5'];
  readonly sourceFilter = signal('all');
  readonly sourceOptions = computed(() => [...new Set(this.expenseService.expenses().map((expense) => expense.source || 'Other'))]
    .sort((a, b) => a.localeCompare(b)));
  readonly sourceFilterOptions = computed<DropdownOption[]>(() => [
    { value: 'all', label: 'All sources' },
    ...this.sourceOptions().map((source) => ({ value: source, label: source })),
  ]);
  private readonly filteredExpenses = computed(() => this.analytics.filterBySource(
    this.expenseService.expenses(),
    this.sourceFilter(),
  ));
  private readonly summary = computed(() => this.analytics.summarize(this.filteredExpenses()));
  readonly peakDay = computed(() => this.summary().peakDay);
  readonly peakMonth = computed(() => this.summary().peakMonth);
  readonly totalSpent = computed(() => this.summary().total);
  readonly categoryChartData = computed<ChartData<'doughnut'>>(() => {
    const categories = this.summary().byCategory;
    const labels = Object.keys(categories);
    return {
      labels: labels.length ? labels : ['No expenses'],
      datasets: [{
        data: labels.length ? Object.values(categories) : [1],
        backgroundColor: this.palette,
        borderWidth: 0,
      }],
    };
  });
  readonly monthlyChartData = computed<ChartData<'bar'>>(() => {
    const breakdown = this.summary().monthlyBreakdown;
    return {
      labels: breakdown.map((item) => item.label),
      datasets: [{
        label: 'Spend',
        data: breakdown.map((item) => item.total),
        backgroundColor: '#168878',
        borderRadius: 5,
      }],
    };
  });
  readonly categoryChartOptions = computed<ChartOptions<'doughnut'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { color: this.chartTextColor() } } },
  }));
  readonly monthlyChartOptions = computed<ChartOptions<'bar'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, ticks: { color: this.chartTextColor() }, grid: { color: this.chartGridColor() } },
      x: { ticks: { color: this.chartTextColor() }, grid: { display: false } },
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
}
