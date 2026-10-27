import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ExpenseItem } from '../../services/analytics.service';
import { AppPreferencesService } from '../../services/app-preferences.service';
import { ExpenseService } from '../../services/expense.service';
import { DropdownComponent, type DropdownOption } from '../../shared/dropdown/dropdown.component';

@Component({
  selector: 'app-transactions-page',
  imports: [DatePipe, FormsModule, DropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './transactions.page.html',
})
export class TransactionsPage {
  private readonly expenseService = inject(ExpenseService);
  readonly preferences = inject(AppPreferencesService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly range = signal<'month' | '30d' | 'year' | 'all'>('month');
  readonly showForm = signal(false);
  readonly editingExpenseId = signal<string | null>(null);
  readonly filteredExpenses = computed(() => this.expenseService.getExpensesByDateRange(this.range()));
  readonly categories = ['Food', 'Transport', 'Housing', 'Bills', 'Shopping', 'Other'];
  readonly categoryOptions: DropdownOption[] = this.categories.map((category) => ({ value: category, label: category }));
  readonly rangeOptions: DropdownOption[] = [
    { value: 'month', label: 'This month' },
    { value: '30d', label: 'Last 30 days' },
    { value: 'year', label: 'This year' },
    { value: 'all', label: 'All time' },
  ];
  readonly sourceOptions = computed(() => [...new Set([
    'Cash', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Other',
    ...this.expenseService.expenses().map((expense) => expense.source || 'Other'),
  ])].sort((a, b) => a.localeCompare(b)));
  readonly sourceDropdownOptions = computed<DropdownOption[]>(() => this.sourceOptions().map((source) => ({ value: source, label: source })));
  readonly amount = signal('');
  readonly category = signal('Food');
  readonly source = signal('Cash');
  readonly expenseDate = signal(new Date().toISOString().slice(0, 10));
  readonly note = signal('');

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      if (params.get('action') === 'add') {
        this.showForm.set(true);
      }
    });
  }

  formatCurrency(value: number): string {
    return this.preferences.formatCurrency(value);
  }

  openNewExpense(): void {
    this.resetForm();
    this.showForm.set(true);
  }

  startEdit(expense: ExpenseItem): void {
    this.editingExpenseId.set(expense.id);
    this.amount.set(String(expense.amount));
    this.category.set(expense.category || 'Other');
    this.source.set(expense.source || 'Other');
    this.expenseDate.set(expense.date.slice(0, 10));
    this.note.set(expense.note || '');
    this.showForm.set(true);
  }

  cancelEdit(): void {
    this.showForm.set(false);
    this.resetForm();
  }

  submitExpense(): void {
    const parsedAmount = Number(this.amount());
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || !this.expenseDate()) {
      return;
    }

    const expense = {
      amount: parsedAmount,
      category: this.category(),
      source: this.source(),
      date: `${this.expenseDate()}T12:00:00.000Z`,
      note: this.note().trim(),
    };
    const editingId = this.editingExpenseId();

    if (editingId) {
      this.expenseService.updateExpense(editingId, expense);
    } else {
      this.expenseService.addExpense(expense);
    }

    this.cancelEdit();
  }

  deleteExpense(id: string): void {
    this.expenseService.deleteExpense(id);
    if (this.editingExpenseId() === id) {
      this.cancelEdit();
    }
  }

  private resetForm(): void {
    this.editingExpenseId.set(null);
    this.amount.set('');
    this.category.set('Food');
    this.source.set('Cash');
    this.expenseDate.set(new Date().toISOString().slice(0, 10));
    this.note.set('');
  }
}
