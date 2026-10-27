import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IncomeFrequency, IncomeProfile, toMonthlyIncome } from './income.model';
import { AppPreferencesService } from '../../services/app-preferences.service';
import { ExpenseService } from '../../services/expense.service';
import { DropdownComponent } from '../../shared/dropdown/dropdown.component';

@Component({
  selector: 'app-income-page',
  imports: [FormsModule, DropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './income.page.html',
})
export class IncomePage {
  private readonly expenseService = inject(ExpenseService);
  readonly preferences = inject(AppPreferencesService);
  private readonly profile = this.expenseService.incomeProfile;

  readonly amount = signal(String(this.profile().amount));
  readonly frequency = signal<IncomeFrequency>(this.profile().frequency);
  readonly nextPayDate = signal(this.profile().nextPayDate);
  readonly saved = signal(false);
  readonly monthlyEquivalent = computed(() => toMonthlyIncome({
    amount: Number(this.amount()),
    frequency: this.frequency(),
    nextPayDate: this.nextPayDate(),
  }));
  readonly payAmount = computed(() => Number(this.amount()) || 0);
  readonly frequencyDetail = computed(() => this.frequencyOptions.find((option) => option.value === this.frequency())?.detail ?? '');
  readonly frequencyOptions: Array<{ value: IncomeFrequency; label: string; detail: string }> = [
    { value: 'weekly', label: 'Weekly', detail: '52 pay periods per year' },
    { value: 'biweekly', label: 'Every two weeks', detail: '26 pay periods per year' },
    { value: 'twice-monthly', label: 'Twice a month', detail: '24 pay periods per year' },
    { value: 'monthly', label: 'Monthly', detail: '12 pay periods per year' },
  ];

  formatCurrency(value: number): string {
    return this.preferences.formatCurrency(value);
  }

  saveIncome(): void {
    const amount = Number(this.amount());
    if (!Number.isFinite(amount) || amount <= 0 || !this.nextPayDate()) {
      return;
    }

    const profile: IncomeProfile = {
      amount,
      frequency: this.frequency(),
      nextPayDate: this.nextPayDate(),
    };
    this.expenseService.setIncomeProfile(profile);
    this.saved.set(true);
  }
}
