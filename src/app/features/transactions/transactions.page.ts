import { DatePipe, DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ExpenseItem } from '../../services/analytics.service';
import { AppPreferencesService } from '../../services/app-preferences.service';
import { ExpenseService } from '../../services/expense.service';
import { ExchangeRateService } from '../../services/exchange-rate.service';
import { ReceiptParserService } from '../../services/receipt-parser.service';
import { DropdownComponent, type DropdownOption } from '../../shared/dropdown/dropdown.component';

@Component({
  selector: 'app-transactions-page',
  imports: [DatePipe, FormsModule, DropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './transactions.page.html',
})
export class TransactionsPage {
  private readonly expenseService = inject(ExpenseService);
  private readonly document = inject(DOCUMENT);
  private readonly receiptParser = inject(ReceiptParserService);
  readonly preferences = inject(AppPreferencesService);
  readonly exchangeRates = inject(ExchangeRateService);
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
  readonly merchant = signal('');
  readonly currency = signal(this.preferences.currency());
  readonly captureStatus = signal('');
  readonly isCapturing = signal(false);
  readonly currencyOptions = computed<DropdownOption[]>(() => this.preferences.currencyOptions.map((currency) => ({
    value: currency,
    label: currency,
  })));

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

  exportCsv(): void {
    const rows = this.filteredExpenses().map((expense) => [
      expense.date.slice(0, 10),
      expense.merchant || '',
      expense.category,
      expense.source,
      expense.note,
      String(expense.amount),
      expense.currency || this.preferences.currency(),
      String(this.exchangeRates.toBase(expense.amount, expense.currency || this.preferences.currency()) ?? ''),
      this.preferences.currency(),
    ]);
    const columns = ['Date', 'Merchant', 'Category', 'Source', 'Note', 'Amount', 'Currency', 'Base amount', 'Base currency'];
    const csv = [columns, ...rows]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = this.document.createElement('a');
    link.href = url;
    link.download = `ledger-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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
    this.merchant.set(expense.merchant || '');
    this.currency.set(expense.currency || this.preferences.currency());
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
      currency: this.currency(),
      merchant: this.merchant().trim(),
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

  async scanReceipt(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.isCapturing.set(true);
    this.captureStatus.set('Reading receipt…');
    try {
      const draft = await this.receiptParser.parseImage(file);
      this.applyParsedDraft(draft);
      this.captureStatus.set('Receipt read. Review the details before saving.');
    } catch {
      this.captureStatus.set('Could not read that receipt. Try a clearer image or enter the details manually.');
    } finally {
      this.isCapturing.set(false);
    }
  }

  startVoiceLogging(): void {
    const recognitionWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition = recognitionWindow.SpeechRecognition ?? recognitionWindow.webkitSpeechRecognition;
    if (!Recognition) {
      this.captureStatus.set('Voice logging is not supported in this browser. You can type the same shorthand.');
      return;
    }

    const recognition = new Recognition();
    recognition.lang = navigator.language || 'en-US';
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      if (transcript) {
        this.note.set(transcript);
        this.applyParsedDraft(this.receiptParser.parseText(transcript));
        this.captureStatus.set(`Captured: ${transcript}`);
      }
      this.isCapturing.set(false);
    };
    recognition.onerror = () => {
      this.captureStatus.set('Voice capture failed. Check microphone access or type the expense instead.');
      this.isCapturing.set(false);
    };
    recognition.onend = () => this.isCapturing.set(false);
    this.isCapturing.set(true);
    this.captureStatus.set('Listening…');
    recognition.start();
  }

  formatExpenseCurrency(expense: ExpenseItem): string {
    return this.preferences.formatCurrency(expense.amount, expense.currency || this.preferences.currency());
  }

  formatBaseAmount(expense: ExpenseItem): string {
    const amount = this.exchangeRates.toBase(expense.amount, expense.currency || this.preferences.currency());
    return amount === null ? 'Rate unavailable' : `${this.formatCurrency(amount)} base`;
  }

  private resetForm(): void {
    this.editingExpenseId.set(null);
    this.amount.set('');
    this.category.set('Food');
    this.source.set('Cash');
    this.expenseDate.set(new Date().toISOString().slice(0, 10));
    this.note.set('');
    this.merchant.set('');
    this.currency.set(this.preferences.currency());
    this.captureStatus.set('');
  }

  private applyParsedDraft(draft: { amount: number | null; merchant: string; category: string; currency: string | null }): void {
    if (draft.amount !== null) this.amount.set(String(draft.amount));
    if (draft.merchant) this.merchant.set(draft.merchant);
    if (this.categories.includes(draft.category)) this.category.set(draft.category);
    if (draft.currency && this.preferences.currencyOptions.includes(draft.currency)) this.currency.set(draft.currency);
  }
}

interface SpeechRecognitionResultLike {
  transcript: string;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>>;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
