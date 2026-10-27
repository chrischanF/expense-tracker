import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IncomeFrequency, IncomeProfile, averagePayAmount, payAmountCount, payAmountsForProfile, toMonthlyIncome } from './income.model';
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

  readonly frequency = signal<IncomeFrequency>(this.profile().frequency);
  readonly payAmounts = signal(payAmountsForProfile(this.profile()));
  readonly nextPayDate = signal(this.profile().nextPayDate);
  readonly saved = signal(false);
  readonly averagePayAmount = computed(() => averagePayAmount(this.payAmounts()));
  readonly monthlyEquivalent = computed(() => toMonthlyIncome({
    amount: this.averagePayAmount(),
    payAmounts: this.payAmounts(),
    frequency: this.frequency(),
    nextPayDate: this.nextPayDate(),
  }));
  readonly payAmountSlots = computed(() => this.payAmounts().map((amount, index) => ({ amount, index })));
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

  setFrequency(frequency: IncomeFrequency): void {
    const currentAmounts = this.payAmounts();
    const fallbackAmount = this.averagePayAmount();
    this.frequency.set(frequency);
    this.payAmounts.set(Array.from({ length: payAmountCount(frequency) }, (_, index) => currentAmounts[index] ?? fallbackAmount));
    this.saved.set(false);
  }

  updatePayAmount(index: number, value: string): void {
    const amount = Number(value);
    this.payAmounts.update((current) => current.map((existing, currentIndex) => currentIndex === index
      ? (Number.isFinite(amount) ? amount : 0)
      : existing));
    this.saved.set(false);
  }

  saveIncome(): void {
    const payAmounts = this.payAmounts().map(Number);
    if (payAmounts.some((amount) => !Number.isFinite(amount) || amount <= 0) || !this.nextPayDate()) {
      return;
    }

    const profile: IncomeProfile = {
      amount: averagePayAmount(payAmounts),
      payAmounts,
      frequency: this.frequency(),
      nextPayDate: this.nextPayDate(),
    };
    this.expenseService.setIncomeProfile(profile);
    this.saved.set(true);
  }
}
