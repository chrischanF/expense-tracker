import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import type { WalletBalance } from '../../models/wallet.model';
import { AppPreferencesService } from '../../services/app-preferences.service';
import { PH_BANK_PRESETS } from './ph-banks.config';

@Component({
  selector: 'app-bank-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bank-card.component.html',
  styleUrl: './bank-card.component.scss',
})
export class BankCardComponent {
  readonly preferences = inject(AppPreferencesService);
  readonly balance = input.required<WalletBalance>();
  readonly selected = input(false);
  readonly compact = input(false);
  readonly selectedChange = output<void>();
  readonly secondaryColor = computed(
    () => PH_BANK_PRESETS.find((preset) => preset.code === this.balance().wallet.bankCode)?.secondary ?? '#0F172A',
  );

  accountTypeLabel(): string {
    return this.balance().wallet.accountType.replace('-', ' ');
  }
}
