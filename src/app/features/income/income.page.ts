import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { averagePayAmount, payAmountCount, payAmountsForProfile, toMonthlyIncome } from './income.model';
import { AppPreferencesService } from '../../services/app-preferences.service';
import { ExpenseService } from '../../services/expense.service';
import { IncomeStreamService } from '../../services/income-stream.service';
import { DropdownComponent } from '../../shared/dropdown/dropdown.component';
import { LoaderComponent } from '../../shared/loader/loader.component';
import type { DropdownOption } from '../../types/dropdown.types';
import type { IncomeFrequency, IncomeProfile, IncomeStream } from '../../types/income.types';
import { toLocalDateInputValue } from '../../utils/date-normalization';

@Component({
  selector: 'app-income-page',
  imports: [DatePipe, FormsModule, DropdownComponent, LoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './income.page.html',
  styleUrl: './income.page.scss',
})
export class IncomePage {
  private readonly expenseService = inject(ExpenseService);
  private readonly incomeStreamService = inject(IncomeStreamService);
  readonly preferences = inject(AppPreferencesService);
  readonly firestoreBusy = computed(() => this.expenseService.isLoading() || this.expenseService.isSaving());
  readonly firestoreLoaderMessage = computed(() =>
    this.expenseService.isLoading() ? 'Loading your account data…' : 'Syncing your changes…',
  );
  private readonly profile = this.expenseService.incomeProfile;

  readonly frequency = signal<IncomeFrequency>(this.profile().frequency);
  readonly payAmounts = signal(payAmountsForProfile(this.profile()));
  readonly nextPayDate = signal(toLocalDateInputValue(this.profile().nextPayDate));
  readonly saved = signal(false);
  private readonly incomeFormDirty = signal(false);
  readonly streams = this.incomeStreamService.streams;
  readonly additionalIncomeThisMonth = this.incomeStreamService.currentMonthTotal;
  readonly streamTypeOptions: DropdownOption[] = [
    'Freelance',
    'Side hustle',
    'Dividend',
    'Gift',
    'Bonus',
    'Asset sale',
    'Other',
  ].map((type) => ({ value: type, label: type }));
  readonly streamName = signal('');
  readonly streamType = signal('Freelance');
  readonly streamAmount = signal('');
  readonly streamDate = signal(toLocalDateInputValue(new Date()));
  readonly streamRepeatsMonthly = signal(false);
  readonly editingStreamId = signal<string | null>(null);
  readonly averagePayAmount = computed(() => averagePayAmount(this.payAmounts()));
  readonly fixedMonthlyEquivalent = computed(() =>
    toMonthlyIncome({
      amount: this.averagePayAmount(),
      payAmounts: this.payAmounts(),
      frequency: this.frequency(),
      nextPayDate: this.nextPayDate(),
    }),
  );
  readonly monthlyEquivalent = computed(() => this.fixedMonthlyEquivalent() + this.additionalIncomeThisMonth());
  readonly payAmountSlots = computed(() => this.payAmounts().map((amount, index) => ({ amount, index })));
  readonly frequencyDetail = computed(
    () => this.frequencyOptions.find((option) => option.value === this.frequency())?.detail ?? '',
  );
  readonly frequencyOptions: Array<{ value: IncomeFrequency; label: string; detail: string }> = [
    { value: 'weekly', label: 'Weekly', detail: '52 pay periods per year' },
    { value: 'biweekly', label: 'Every two weeks', detail: '26 pay periods per year' },
    { value: 'twice-monthly', label: 'Twice a month', detail: '24 pay periods per year' },
    { value: 'monthly', label: 'Monthly', detail: '12 pay periods per year' },
  ];

  constructor() {
    effect(() => {
      const profile = this.profile();
      if (this.incomeFormDirty()) return;
      this.frequency.set(profile.frequency);
      this.payAmounts.set(payAmountsForProfile(profile));
      this.nextPayDate.set(toLocalDateInputValue(profile.nextPayDate));
    });
  }

  formatCurrency(value: number): string {
    return this.preferences.formatCurrency(value);
  }

  setFrequency(frequency: IncomeFrequency): void {
    this.incomeFormDirty.set(true);
    const currentAmounts = this.payAmounts();
    const fallbackAmount = this.averagePayAmount();
    this.frequency.set(frequency);
    this.payAmounts.set(
      Array.from({ length: payAmountCount(frequency) }, (_, index) => currentAmounts[index] ?? fallbackAmount),
    );
    this.saved.set(false);
  }

  updatePayAmount(index: number, value: string): void {
    this.incomeFormDirty.set(true);
    const amount = Number(value);
    this.payAmounts.update((current) =>
      current.map((existing, currentIndex) =>
        currentIndex === index ? (Number.isFinite(amount) ? amount : 0) : existing,
      ),
    );
    this.saved.set(false);
  }

  updateNextPayDate(value: string): void {
    this.incomeFormDirty.set(true);
    this.nextPayDate.set(value);
    this.saved.set(false);
  }

  saveIncome(): void {
    const payAmounts = this.payAmounts().map(Number);
    if (payAmounts.some((amount) => !Number.isFinite(amount) || amount < 0) || !this.nextPayDate()) {
      return;
    }

    const profile: IncomeProfile = {
      amount: averagePayAmount(payAmounts),
      payAmounts,
      frequency: this.frequency(),
      nextPayDate: this.nextPayDate(),
    };
    this.incomeFormDirty.set(false);
    this.expenseService.setIncomeProfile(profile);
    this.saved.set(true);
  }

  saveIncomeStream(): void {
    const amount = Number(this.streamAmount());
    if (!this.streamName().trim() || !Number.isFinite(amount) || amount <= 0 || !this.streamDate()) return;
    const stream = {
      name: this.streamName().trim(),
      type: this.streamType(),
      amount,
      date: this.streamDate(),
      repeatsMonthly: this.streamRepeatsMonthly(),
    };
    const editingId = this.editingStreamId();
    if (editingId) {
      const current = this.streams().find((entry) => entry.id === editingId);
      if (current) this.incomeStreamService.update({ ...current, ...stream });
    } else {
      this.incomeStreamService.add(stream);
    }
    this.resetIncomeStreamForm();
  }

  editIncomeStream(stream: IncomeStream): void {
    this.editingStreamId.set(stream.id);
    this.streamName.set(stream.name);
    this.streamType.set(stream.type);
    this.streamAmount.set(String(stream.amount));
    this.streamDate.set(toLocalDateInputValue(stream.date));
    this.streamRepeatsMonthly.set(stream.repeatsMonthly);
  }

  deleteIncomeStream(id: string): void {
    this.incomeStreamService.delete(id);
    if (this.editingStreamId() === id) this.resetIncomeStreamForm();
  }

  resetIncomeStreamForm(): void {
    this.editingStreamId.set(null);
    this.streamName.set('');
    this.streamType.set('Freelance');
    this.streamAmount.set('');
    this.streamDate.set(toLocalDateInputValue(new Date()));
    this.streamRepeatsMonthly.set(false);
  }
}
