import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AnalyticsService } from '../../services/analytics.service';
import { AppPreferencesService } from '../../services/app-preferences.service';
import { ExpenseService } from '../../services/expense.service';
import { PlanningService } from '../../services/planning.service';
import { BudgetProgressComponent } from '../../shared/budget-progress/budget-progress.component';

@Component({
  selector: 'app-dashboard-page',
  imports: [BudgetProgressComponent, DatePipe, DecimalPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.page.html',
})
export class DashboardPage {
  private readonly expensesService = inject(ExpenseService);
  private readonly analytics = inject(AnalyticsService);
  private readonly preferences = inject(AppPreferencesService);
  private readonly planning = inject(PlanningService);

  readonly expenses = this.expensesService.expenses;
  readonly incomeProfile = this.expensesService.incomeProfile;
  readonly monthlyIncome = this.expensesService.monthlyIncome;
  readonly summary = computed(() => this.analytics.summarize(this.expensesService.getExpensesByDateRange('month')));
  readonly recentExpenses = computed(() => this.expenses().slice(0, 4));
  readonly frequencyLabel = computed(() => ({
    weekly: 'weekly',
    biweekly: 'every two weeks',
    'twice-monthly': 'twice a month',
    monthly: 'monthly',
  })[this.incomeProfile().frequency]);
  readonly remainingBalance = computed(() => this.monthlyIncome() - this.summary().total);
  readonly incomeUsageRatio = computed(() => this.monthlyIncome() > 0
    ? this.summary().total / this.monthlyIncome() * 100
    : 0);
  readonly budgetStatus = computed<'healthy' | 'watch' | 'critical' | 'over'>(() => {
    const usage = this.incomeUsageRatio();
    if (usage >= 100) return 'over';
    if (usage >= 90) return 'critical';
    if (usage >= 70) return 'watch';
    return 'healthy';
  });
  readonly budgetProgress = computed(() => {
    const expenses = this.expensesService.getExpensesByDateRange('month');
    return this.planning.budgets().map((budget) => ({
      ...budget,
      spent: expenses.filter((expense) => expense.category === budget.category)
        .reduce((total, expense) => total + expense.amount, 0),
    }));
  });

  formatCurrency(value: number): string {
    return this.preferences.formatCurrency(value);
  }
}
