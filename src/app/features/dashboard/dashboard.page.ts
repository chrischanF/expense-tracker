import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AnalyticsService } from '../../services/analytics.service';
import { AppPreferencesService } from '../../services/app-preferences.service';
import { ExpenseService } from '../../services/expense.service';
import { IncomeStreamService } from '../../services/income-stream.service';
import { ExchangeRateService } from '../../services/exchange-rate.service';
import { BillReminderService } from '../../services/bill-reminder.service';
import { PlanningService } from '../../services/planning.service';
import { calculateSafeToSpend, getUpcomingBills } from '../../services/planning.model';
import { BudgetProgressComponent } from '../../shared/budget-progress/budget-progress.component';
import { LoaderComponent } from '../../shared/loader/loader.component';
import { toLocalDateInputValue } from '../../utils/date-normalization';

@Component({
  selector: 'app-dashboard-page',
  imports: [BudgetProgressComponent, DatePipe, LoaderComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage {
  private readonly categoryIcons: Record<string, string> = {
    food: '🍽️',
    transport: '🚗',
    housing: '🏠',
    bills: '🧾',
    shopping: '🛒',
    other: '⋯',
  };

  private readonly expensesService = inject(ExpenseService);
  private readonly incomeStreams = inject(IncomeStreamService);
  private readonly analytics = inject(AnalyticsService);
  readonly preferences = inject(AppPreferencesService);
  private readonly planning = inject(PlanningService);
  readonly exchangeRates = inject(ExchangeRateService);
  readonly billReminders = inject(BillReminderService);
  readonly firestoreBusy = computed(
    () =>
      this.expensesService.isLoading() ||
      this.expensesService.isSaving() ||
      this.planning.isLoading() ||
      this.planning.isSaving(),
  );
  readonly firestoreLoaderMessage = computed(() =>
    this.expensesService.isLoading() || this.planning.isLoading()
      ? 'Loading your account data…'
      : 'Syncing your changes…',
  );

  readonly expenses = this.expensesService.expenses;
  readonly incomeProfile = this.expensesService.incomeProfile;
  readonly fixedMonthlyIncome = this.expensesService.monthlyIncome;
  readonly additionalIncomeThisMonth = this.incomeStreams.currentMonthTotal;
  readonly monthlyIncome = computed(() => this.fixedMonthlyIncome() + this.additionalIncomeThisMonth());
  readonly baseMonthExpenses = computed(() =>
    this.expensesService
      .getExpensesByDateRange('month')
      .map((expense) => ({
        expense,
        amount: this.exchangeRates.toBase(expense.amount, expense.currency || this.preferences.currency()),
      }))
      .filter((entry) => entry.amount !== null)
      .map(({ expense, amount }) => ({ ...expense, amount: amount ?? 0 })),
  );
  readonly summary = computed(() => this.analytics.summarize(this.baseMonthExpenses()));
  readonly recentExpenses = computed(() => this.expenses().slice(0, 4));
  readonly frequencyLabel = computed(
    () =>
      ({
        weekly: 'weekly',
        biweekly: 'every two weeks',
        'twice-monthly': 'twice a month',
        monthly: 'monthly',
      })[this.incomeProfile().frequency],
  );
  readonly remainingBalance = computed(() => this.monthlyIncome() - this.summary().total);
  readonly incomeUsageRatio = computed(() =>
    this.monthlyIncome() > 0 ? (this.summary().total / this.monthlyIncome()) * 100 : 0,
  );
  readonly budgetStatus = computed<'healthy' | 'watch' | 'critical' | 'over'>(() => {
    const usage = this.incomeUsageRatio();
    if (usage >= 100) return 'over';
    if (usage >= 90) return 'critical';
    if (usage >= 70) return 'watch';
    return 'healthy';
  });
  readonly budgetProgress = computed(() => {
    const expenses = this.baseMonthExpenses();
    return this.planning.budgets().map((budget) => ({
      ...budget,
      spent: expenses
        .filter((expense) => expense.category === budget.category)
        .reduce((total, expense) => total + expense.amount, 0),
    }));
  });
  readonly allowancePeriod = signal<'daily' | 'weekly'>('daily');
  readonly safeToSpendPlan = computed(() => {
    const currentExpenses = this.expensesService.getExpensesByDateRange('month');
    const recordedRecurring = new Set(currentExpenses.map((expense) => expense.recurringId).filter(Boolean));
    const upcomingRecurring = this.planning
      .recurringTransactions()
      .filter((item) => item.active && !recordedRecurring.has(item.id))
      .reduce(
        (total, item) =>
          total + (this.exchangeRates.toBase(item.amount, item.currency || this.preferences.currency()) ?? 0),
        0,
      );
    const monthlyGoalContributions = this.planning
      .goals()
      .reduce((total, goal) => total + (goal.monthlyContribution ?? 0), 0);
    return calculateSafeToSpend(
      this.monthlyIncome(),
      this.summary().total,
      upcomingRecurring,
      monthlyGoalContributions,
    );
  });
  readonly safeToSpendAmount = computed(() =>
    this.allowancePeriod() === 'daily' ? this.safeToSpendPlan().daily : this.safeToSpendPlan().weekly,
  );
  readonly upcomingBills = computed(() => {
    const today = new Date();
    const bills = getUpcomingBills(this.planning.recurringTransactions(), today, 7);
    const recorded = new Set(
      this.expensesService
        .expenses()
        .filter((expense) => expense.recurringMonth)
        .map((expense) => `${expense.recurringId}:${expense.recurringMonth}`),
    );
    return bills.filter((bill) => !recorded.has(`${bill.id}:${toLocalDateInputValue(bill.dueDate).slice(0, 7)}`));
  });

  formatCurrency(value: number): string {
    return this.preferences.formatCurrency(value);
  }

  categoryIcon(category: string): string {
    return this.categoryIcons[category.trim().toLowerCase()] ?? '•';
  }

  enableBillReminders(): void {
    void this.billReminders.enable();
  }
}
