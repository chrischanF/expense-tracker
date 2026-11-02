import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AnalyticsService } from '../../services/analytics.service';
import { AppPreferencesService } from '../../services/app-preferences.service';
import { ExpenseService } from '../../services/expense.service';
import { IncomeStreamService } from '../../services/income-stream.service';
import { ExchangeRateService } from '../../services/exchange-rate.service';
import { BillReminderService } from '../../services/bill-reminder.service';
import { PlanningService } from '../../services/planning.service';
import { getUpcomingBills } from '../../services/planning.model';
import { PayPeriodFilterService } from '../../services/pay-period-filter.service';
import { WalletService } from '../../services/wallet.service';
import { LoaderComponent } from '../../shared/loader/loader.component';
import { toLocalDateInputValue } from '../../utils/date-normalization';
import { DashboardHeaderComponent } from './dashboard-header.component';
import { DashboardWalletsComponent } from './dashboard-wallets.component';
import { DashboardPlanningComponent } from './dashboard-planning.component';
import { DashboardBudgetsComponent, type DashboardBudget } from './dashboard-budgets.component';
import { DashboardActivityComponent } from './dashboard-activity.component';
import { DashboardInsightsComponent } from './dashboard-insights.component';
import { DashboardGoalsComponent } from './dashboard-goals.component';
import { DashboardRemindersComponent } from './dashboard-reminders.component';

@Component({
  selector: 'app-dashboard-page',
  imports: [
    DashboardHeaderComponent,
    DashboardWalletsComponent,
    DashboardPlanningComponent,
    DashboardBudgetsComponent,
    DashboardActivityComponent,
    DashboardInsightsComponent,
    DashboardGoalsComponent,
    DashboardRemindersComponent,
    LoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage {
  private readonly expensesService = inject(ExpenseService);
  private readonly incomeStreams = inject(IncomeStreamService);
  readonly walletService = inject(WalletService);
  private readonly analytics = inject(AnalyticsService);
  private readonly payPeriodFilter = inject(PayPeriodFilterService);
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
  readonly walletBalances = this.walletService.walletBalances;
  private readonly selectedExpenses = computed(() => {
    const walletId = this.walletService.selectedWalletId();
    return walletId ? this.expenses().filter((expense) => expense.walletId === walletId) : this.expenses();
  });
  readonly incomeProfile = this.expensesService.incomeProfile;
  readonly activePayPeriod = this.payPeriodFilter.selectedPeriod;
  readonly fixedMonthlyIncome = this.expensesService.monthlyIncome;
  readonly additionalIncomeThisMonth = this.incomeStreams.currentMonthTotal;
  readonly monthlyIncome = computed(() => this.fixedMonthlyIncome() + this.additionalIncomeThisMonth());
  readonly baseMonthExpenses = computed(() =>
    this.expensesService
      .getExpensesByDateRange('month')
      .filter(
        (expense) =>
          !this.walletService.selectedWalletId() || expense.walletId === this.walletService.selectedWalletId(),
      )
      .map((expense) => ({
        expense,
        amount: this.exchangeRates.toBase(expense.amount, expense.currency || this.preferences.currency()),
      }))
      .filter((entry) => entry.amount !== null)
      .map(({ expense, amount }) => ({ ...expense, amount: amount ?? 0 })),
  );
  readonly overviewExpenses = computed(() => {
    const period = this.activePayPeriod();
    if (!period) return this.baseMonthExpenses();
    return this.payPeriodFilter.filterExpenses(this.selectedExpenses()).map((expense) => ({
      ...expense,
      amount: this.exchangeRates.toBase(expense.amount, expense.currency || this.preferences.currency()) ?? 0,
    }));
  });
  readonly summary = computed(() => this.analytics.summarize(this.overviewExpenses()));
  readonly recentExpenses = computed(() => this.overviewExpenses().slice(0, 4));
  readonly trendExpenses = computed(() =>
    this.selectedExpenses()
      .map((expense) => ({
        expense,
        amount: this.exchangeRates.toBase(expense.amount, expense.currency || this.preferences.currency()),
      }))
      .filter((entry) => entry.amount !== null)
      .map(({ expense, amount }) => ({ ...expense, amount: amount ?? 0 })),
  );
  readonly periodIncome = computed(() => this.activePayPeriod()?.amount ?? this.monthlyIncome());
  readonly remainingBalance = computed(() => this.periodIncome() - this.summary().total);
  readonly budgetProgress = computed<DashboardBudget[]>(() => {
    const expenses = this.overviewExpenses();
    return this.planning.budgets().map((budget) => ({
      ...budget,
      spent: expenses
        .filter((expense) => expense.category === budget.category)
        .reduce((total, expense) => total + expense.amount, 0),
    }));
  });
  readonly allowancePeriod = signal<'daily' | 'weekly'>('daily');
  readonly safeToSpendPlan = computed(() => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const period = this.activePayPeriod();
    const periodStart = period
      ? new Date(`${toLocalDateInputValue(period.startDate)}T00:00:00`)
      : new Date(today.getFullYear(), today.getMonth(), 1);
    const periodEnd = period
      ? new Date(`${toLocalDateInputValue(period.endDate)}T23:59:59.999`)
      : new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    const isCurrentPeriod = periodStart <= todayStart && periodEnd >= todayStart;
    const periodLength = Math.max(1, Math.ceil((periodEnd.getTime() - periodStart.getTime() + 1) / 86_400_000));
    const daysRemaining = isCurrentPeriod
      ? Math.max(1, Math.ceil((periodEnd.getTime() - todayStart.getTime() + 1) / 86_400_000))
      : periodLength;
    const upcomingRecurring = isCurrentPeriod
      ? this.upcomingBills()
          .filter((bill) => {
            const dueDate = toLocalDateInputValue(bill.dueDate);
            return dueDate >= toLocalDateInputValue(todayStart) && dueDate <= toLocalDateInputValue(periodEnd);
          })
          .reduce(
            (total, bill) =>
              total + (this.exchangeRates.toBase(bill.amount, bill.currency || this.preferences.currency()) ?? 0),
            0,
          )
      : 0;
    const monthlyGoals = isCurrentPeriod
      ? this.planning.goals().reduce((total, goal) => total + (goal.monthlyContribution ?? 0), 0)
      : 0;
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const remaining = Math.max(
      0,
      this.periodIncome() - this.summary().total - upcomingRecurring - (monthlyGoals * daysRemaining) / daysInMonth,
    );
    const daily = remaining / daysRemaining;
    return { remaining, daily, weekly: Math.min(remaining, daily * 7), daysRemaining };
  });
  readonly safeToSpendAmount = computed(() =>
    this.allowancePeriod() === 'daily' ? this.safeToSpendPlan().daily : this.safeToSpendPlan().weekly,
  );
  readonly safeToSpendRatio = computed(() =>
    this.periodIncome() > 0 ? Math.min(100, (this.safeToSpendPlan().remaining / this.periodIncome()) * 100) : 0,
  );
  readonly savingsGoals = this.planning.goals;
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

  enableBillReminders(): void {
    void this.billReminders.enable();
  }
}
