import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Wallet as WalletModel, WalletAccountType, WalletBankCode } from '../../models/wallet.model';
import { AppPreferencesService } from '../../services/app-preferences.service';
import { WalletService } from '../../services/wallet.service';
import { BankCardComponent } from './bank-card.component';
import { PH_BANK_PRESETS } from './ph-banks.config';

@Component({
  imports: [BankCardComponent, FormsModule],
  selector: 'app-wallet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './wallet.scss',
  templateUrl: './wallet.html',
})
export class Wallet {
  readonly walletService = inject(WalletService);
  readonly preferences = inject(AppPreferencesService);
  readonly banks = PH_BANK_PRESETS;
  readonly accountTypes: Array<{ value: WalletAccountType; label: string }> = [
    { value: 'savings', label: 'Savings' },
    { value: 'checking', label: 'Checking' },
    { value: 'credit', label: 'Credit' },
    { value: 'wallet', label: 'Digital wallet' },
    { value: 'cash', label: 'Cash' },
  ];
  readonly bankCode = signal<WalletBankCode>('cash');
  readonly name = signal('Cash Wallet');
  readonly accountType = signal<WalletAccountType>('cash');
  readonly initialBalance = signal('');
  readonly accountNumberLast4 = signal('');
  readonly editingId = signal<string | null>(null);
  readonly selectedPreset = computed(() => this.banks.find((bank) => bank.code === this.bankCode()) ?? this.banks[0]);

  formatCurrency(value: number): string {
    return this.preferences.formatCurrency(value);
  }

  setBankCode(value: string): void {
    const bank = this.banks.find((preset) => preset.code === value);
    if (!bank) return;
    this.bankCode.set(bank.code);
    this.name.set(bank.name);
    if (bank.code === 'cash') this.accountType.set('cash');
    else if (['gcash', 'maya', 'maribank', 'gotyme', 'seabank'].includes(bank.code)) this.accountType.set('wallet');
    else this.accountType.set('savings');
  }

  saveWallet(): void {
    const amount = Number(this.initialBalance());
    const name = this.name().trim();
    if (!name || !Number.isFinite(amount) || amount < 0) return;
    const walletData = {
      name,
      bankCode: this.bankCode(),
      accountType: this.accountType(),
      initialBalance: amount,
      accountNumberLast4: this.accountNumberLast4().replace(/\D/g, '').slice(-4),
      colorHex: this.selectedPreset().primary,
    };
    const editingId = this.editingId();
    if (editingId) {
      const current = this.walletService.getWallets().find((wallet) => wallet.id === editingId);
      if (current) this.walletService.updateWallet({ ...current, ...walletData });
    } else {
      this.walletService.addWallet(walletData);
    }
    this.resetForm();
  }

  editWallet(wallet: WalletModel): void {
    this.editingId.set(wallet.id);
    this.bankCode.set(wallet.bankCode);
    this.name.set(wallet.name);
    this.accountType.set(wallet.accountType);
    this.initialBalance.set(String(wallet.initialBalance));
    this.accountNumberLast4.set(wallet.accountNumberLast4 ?? '');
  }

  deleteWallet(id: string): void {
    this.walletService.deleteWallet(id);
    if (this.editingId() === id) this.resetForm();
  }

  resetForm(): void {
    this.editingId.set(null);
    this.bankCode.set('cash');
    this.name.set('Cash Wallet');
    this.accountType.set('cash');
    this.initialBalance.set('');
    this.accountNumberLast4.set('');
  }
}
