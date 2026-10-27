import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppPreferencesService } from '../../services/app-preferences.service';
import { ExchangeRateService } from '../../services/exchange-rate.service';
import { PlanningService } from '../../services/planning.service';
import { EXPENSE_CATEGORIES } from '../../services/planning.model';
import type { RecurringTransaction } from '../../types/planning.types';
import { DropdownComponent } from '../../shared/dropdown/dropdown.component';
import type { DropdownOption } from '../../types/dropdown.types';

@Component({
  selector: 'app-recurring-page',
  imports: [DropdownComponent, FormsModule],
  templateUrl: './recurring.page.html',
  styleUrl: './recurring.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecurringPage {
  private readonly planning = inject(PlanningService);
  readonly preferences = inject(AppPreferencesService);
  readonly exchangeRates = inject(ExchangeRateService);
  readonly items = this.planning.recurringTransactions;
  readonly categories: DropdownOption[] = EXPENSE_CATEGORIES.map((category) => ({ value: category, label: category }));
  readonly sources: DropdownOption[] = ['Cash', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Other'].map(
    (source) => ({ value: source, label: source }),
  );
  readonly currencyOptions = computed<DropdownOption[]>(() =>
    this.preferences.currencyOptions.map((currency) => ({ value: currency, label: currency })),
  );
  readonly activeTotal = computed(() =>
    this.items()
      .filter((item) => item.active)
      .reduce(
        (total, item) =>
          total + (this.exchangeRates.toBase(item.amount, item.currency || this.preferences.currency()) ?? 0),
        0,
      ),
  );

  readonly editingId = signal<string | null>(null);
  readonly name = signal('');
  readonly amount = signal('');
  readonly category = signal<string>(EXPENSE_CATEGORIES[0]);
  readonly source = signal('Bank Transfer');
  readonly currency = signal(this.preferences.currency());
  readonly dueDay = signal(String(new Date().getDate()));

  save(): void {
    const amount = Number(this.amount());
    const dueDay = Number(this.dueDay());
    if (!this.name().trim() || !Number.isFinite(amount) || amount <= 0 || dueDay < 1 || dueDay > 31) {
      return;
    }
    const item = {
      name: this.name().trim(),
      amount,
      category: this.category(),
      source: this.source(),
      currency: this.currency(),
      dueDay,
      active: true,
    };
    const editingId = this.editingId();
    if (editingId) {
      const current = this.items().find((entry) => entry.id === editingId);
      if (current) this.planning.updateRecurringTransaction({ ...current, ...item });
    } else {
      this.planning.addRecurringTransaction(item);
    }
    this.resetForm();
  }

  edit(item: RecurringTransaction): void {
    this.editingId.set(item.id);
    this.name.set(item.name);
    this.amount.set(String(item.amount));
    this.category.set(item.category);
    this.source.set(item.source);
    this.currency.set(item.currency || this.preferences.currency());
    this.dueDay.set(String(item.dueDay));
  }

  toggle(item: RecurringTransaction): void {
    this.planning.updateRecurringTransaction({ ...item, active: !item.active });
  }

  remove(id: string): void {
    this.planning.deleteRecurringTransaction(id);
    if (this.editingId() === id) this.resetForm();
  }

  resetForm(): void {
    this.editingId.set(null);
    this.name.set('');
    this.amount.set('');
    this.category.set(EXPENSE_CATEGORIES[0]);
    this.source.set('Bank Transfer');
    this.currency.set(this.preferences.currency());
    this.dueDay.set(String(new Date().getDate()));
  }

  formatCurrency(amount: number): string {
    return this.preferences.formatCurrency(amount);
  }
}
