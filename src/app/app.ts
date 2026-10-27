import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { AnalyticsService } from './services/analytics.service';
import { ExpenseService } from './services/expense.service';
import { AuthService } from './services/auth.service';
import { FirebaseService } from './services/firebase.service';

@Component({
  selector: 'app-root',
  imports: [FormsModule, BaseChartDirective, DatePipe],
  templateUrl: './app.html',
})
export class App {
  private readonly analyticsService = new AnalyticsService();
  private readonly authService = inject(AuthService);
  private readonly expenseService = inject(ExpenseService);
  private readonly firebaseService = inject(FirebaseService);

  readonly currentUser = this.authService.currentUser;
  readonly authError = this.authService.errorMessage;
  readonly expenses = this.expenseService.expenses;
  readonly monthlyIncome = this.expenseService.monthlyIncome;
  readonly syncStatus = this.expenseService.syncStatus;
  readonly isOnline = this.firebaseService.isOnline;
  readonly theme = signal<'light' | 'dark'>(this.readTheme());
  range: 'month' | '30d' | 'year' | 'all' = 'month';
  editingExpenseId: string | null = null;

  readonly currencyOptions: string[] = this.getCurrencyList();
  selectedCurrency = this.readStoredCurrency();

  amount = '';
  category = 'Food';
  expenseDate = new Date().toISOString().slice(0, 10);
  note = '';
  monthlyIncomeInput = String(this.expenseService.monthlyIncome());

  get filteredExpenses() {
    return this.expenseService.getExpensesByDateRange(this.range);
  }

  get summary() {
    return this.analyticsService.summarize(this.filteredExpenses);
  }

  get remainingBalance(): number {
    return this.monthlyIncome() - this.summary.total;
  }

  get incomeUsageRatio(): number {
    if (this.monthlyIncome() <= 0) {
      return 0;
    }

    return (this.summary.total / this.monthlyIncome()) * 100;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: this.selectedCurrency,
      maximumFractionDigits: 2,
    }).format(value);
  }

  categoryChartData: any = {
    labels: ['No data'],
    datasets: [{
      data: [0],
      backgroundColor: ['#168878', '#e3a23b', '#607f9b', '#d9755e', '#81a94c', '#9b7bb5'],
    }],
  };

  trendChartData: any = {
    labels: [],
    datasets: [{
      label: 'Spend',
      data: [],
      backgroundColor: '#168878',
      borderRadius: 8,
    }],
  };

  readonly categoryChartType: any = 'doughnut';
  readonly trendChartType: any = 'bar';
  chartOptions: any = this.createChartOptions(this.theme());

  constructor() {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset['theme'] = this.theme();
    }
    this.refreshDashboard();
  }

  private readTheme(): 'light' | 'dark' {
    if (typeof localStorage === 'undefined') {
      return 'light';
    }

    try {
      const savedTheme = localStorage.getItem('expense-tracker.theme');
      if (savedTheme === 'light' || savedTheme === 'dark') {
        return savedTheme;
      }
    } catch {
      return 'light';
    }

    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private createChartOptions(theme: 'light' | 'dark'): any {
    const textColor = theme === 'dark' ? '#b9c9c1' : '#68766f';
    const gridColor = theme === 'dark' ? 'rgba(185, 201, 193, 0.12)' : 'rgba(55, 74, 65, 0.1)';

    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: textColor } } },
      scales: {
        y: { ticks: { color: textColor }, grid: { color: gridColor } },
        x: { ticks: { color: textColor }, grid: { display: false } },
      },
    };
  }

  toggleTheme(): void {
    const nextTheme = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(nextTheme);
    if (typeof document !== 'undefined') {
      document.documentElement.dataset['theme'] = nextTheme;
    }
    try {
      localStorage.setItem('expense-tracker.theme', nextTheme);
    } catch {}
    this.chartOptions = this.createChartOptions(nextTheme);
  }

  private getCurrencyList(): string[] {
    const values = typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl
      ? Intl.supportedValuesOf('currency')
      : [
          'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'BRL', 'MXN', 'ZAR', 'SEK', 'NOK', 'DKK', 'PLN', 'RON', 'AED', 'SGD', 'HKD', 'SAR', 'NGN', 'EGP', 'KES', 'RSD'
        ];

    return [...new Set(values)].sort();
  }

  private readStoredCurrency(): string {
    if (typeof localStorage === 'undefined') {
      return 'USD';
    }

    try {
      const stored = localStorage.getItem('expense-tracker.selected-currency');
      return stored && this.currencyOptions.includes(stored) ? stored : 'USD';
    } catch {
      return 'USD';
    }
  }

  applyCurrencySelection(): void {
    if (!this.selectedCurrency) {
      return;
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('expense-tracker.selected-currency', this.selectedCurrency);
    }
  }

  refreshDashboard(): void {
    const currentExpenses = this.filteredExpenses;
    const categoryTotal = this.analyticsService.summarize(currentExpenses).byCategory;
    const categoryLabels = Object.keys(categoryTotal);
    const categoryValues = Object.values(categoryTotal);

    this.categoryChartData = {
      labels: categoryLabels.length ? categoryLabels : ['No data'],
      datasets: [{
        data: categoryValues.length ? categoryValues : [0],
        backgroundColor: ['#168878', '#e3a23b', '#607f9b', '#d9755e', '#81a94c', '#9b7bb5'],
      }],
    };

    const monthlyBreakdown = this.analyticsService.summarize(this.expenses()).monthlyBreakdown;
    this.trendChartData = {
      labels: monthlyBreakdown.map((item) => item.label),
      datasets: [{
        label: 'Spend',
        data: monthlyBreakdown.map((item) => item.total),
        backgroundColor: '#168878',
        borderRadius: 8,
      }],
    };
  }

  signIn(): void {
    void this.authService.signInWithGoogle();
  }

  signOut(): void {
    void this.authService.signOut();
  }

  saveMonthlyIncome(): void {
    const value = Number(this.monthlyIncomeInput);
    if (Number.isNaN(value)) {
      return;
    }

    this.expenseService.setMonthlyIncome(value);
    this.monthlyIncomeInput = String(this.monthlyIncome());
    this.refreshDashboard();
  }

  private resetExpenseForm(): void {
    this.amount = '';
    this.note = '';
    this.category = 'Food';
    this.expenseDate = new Date().toISOString().slice(0, 10);
  }

  startEdit(expense: { id: string; amount: number; category: string; date: string; note: string }): void {
    this.editingExpenseId = expense.id;
    this.amount = String(expense.amount);
    this.category = expense.category || 'Food';
    this.expenseDate = expense.date ? expense.date.slice(0, 10) : new Date().toISOString().slice(0, 10);
    this.note = expense.note || '';
  }

  cancelExpenseEdit(): void {
    this.editingExpenseId = null;
    this.resetExpenseForm();
  }

  submitExpense(): void {
    const parsedAmount = Number(this.amount);
    if (!parsedAmount || Number.isNaN(parsedAmount)) {
      return;
    }

    const payload = {
      amount: parsedAmount,
      category: this.category,
      date: `${this.expenseDate}T12:00:00.000Z`,
      note: this.note,
    };

    if (this.editingExpenseId) {
      this.expenseService.updateExpense(this.editingExpenseId, payload);
      this.editingExpenseId = null;
    } else {
      this.expenseService.addExpense(payload);
    }

    this.resetExpenseForm();
    this.refreshDashboard();
  }

  deleteExpense(id: string): void {
    this.expenseService.deleteExpense(id);

    if (this.editingExpenseId === id) {
      this.cancelExpenseEdit();
    }

    this.refreshDashboard();
  }

  onRangeChange(): void {
    this.refreshDashboard();
  }
}
