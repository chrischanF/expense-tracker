import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { WalletBalance } from '../../models/wallet.model';
import { BankCardComponent } from '../wallet/bank-card.component';

@Component({
  selector: 'app-dashboard-wallets',
  imports: [BankCardComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-wallets.component.html',
  styleUrl: './dashboard-wallets.component.scss',
})
export class DashboardWalletsComponent {
  readonly balances = input.required<WalletBalance[]>();
  readonly selectedWalletId = input<string | null>(null);
  readonly selectedWalletName = input<string | null>(null);
  readonly walletSelected = output<string | null>();
}
