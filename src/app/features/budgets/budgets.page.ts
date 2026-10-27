import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppPreferencesService } from '../../services/app-preferences.service';
import { ExpenseService } from '../../services/expense.service';
import { ExchangeRateService } from '../../services/exchange-rate.service';
import { EXPENSE_CATEGORIES } from '../../services/planning.model';
import type { CategoryBudget } from '../../types/planning.types';
import { PlanningService } from '../../services/planning.service';
import { BudgetProgressComponent } from '../../shared/budget-progress/budget-progress.component';
import { DropdownComponent } from '../../shared/dropdown/dropdown.component';
import type { DropdownOption } from '../../types/dropdown.types';
import { LoaderComponent } from '../../shared/loader/loader.component';

@Component({
  selector: 'app-budgets-page',
  imports: [BudgetProgressComponent, DropdownComponent, FormsModule, LoaderComponent],
  templateUrl: './budgets.page.html',
  styleUrl: './budgets.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetsPage {
  private readonly planning = inject(PlanningService);
  private readonly expenses = inject(ExpenseService);
  readonly preferences = inject(AppPreferencesService);
  private readonly exchangeRates = inject(ExchangeRateService);
  readonly firestoreBusy = computed(
    () =>
      this.expenses.isLoading() || this.expenses.isSaving() || this.planning.isLoading() || this.planning.isSaving(),
  );
  readonly firestoreLoaderMessage = computed(() =>
    this.expenses.isLoading() || this.planning.isLoading() ? 'Loading your budgets…' : 'Syncing your changes…',
  );
  readonly categories: DropdownOption[] = EXPENSE_CATEGORIES.map((category) => ({ value: category, label: category }));
  readonly budgets = computed(() => {
    const expenses = this.expenses
      .getExpensesByDateRange('month')
      .map((expense) => ({
        expense,
        amount: this.exchangeRates.toBase(expense.amount, expense.currency || this.preferences.currency()),
      }))
      .filter((entry) => entry.amount !== null);
    return this.planning.budgets().map((budget) => ({
      ...budget,
      spent: expenses
        .filter((entry) => entry.expense.category === budget.category)
        .reduce((total, entry) => total + (entry.amount ?? 0), 0),
    }));
  });
  readonly selectedCategory = signal<string>(EXPENSE_CATEGORIES[0]);
  readonly monthlyLimit = signal('');

  saveBudget(): void {
    const limit = Number(this.monthlyLimit());
    if (!Number.isFinite(limit) || limit <= 0) return;
    this.planning.setBudget(this.selectedCategory(), limit);
    this.monthlyLimit.set('');
  }

  editBudget(budget: CategoryBudget): void {
    this.selectedCategory.set(budget.category);
    this.monthlyLimit.set(String(budget.monthlyLimit));
  }

  deleteBudget(id: string): void {
    this.planning.deleteBudget(id);
  }

  formatCurrency(amount: number): string {
    return this.preferences.formatCurrency(amount);
  }
}
