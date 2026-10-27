import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppPreferencesService } from '../../services/app-preferences.service';
import { AuthService } from '../../services/auth.service';
import { TourService } from '../../services/tour.service';
import { ALL_PAY_PERIODS_KEY, PayPeriodFilterService } from '../../services/pay-period-filter.service';
import { DropdownComponent } from '../../shared/dropdown/dropdown.component';
import type { DropdownOption } from '../../types/dropdown.types';

@Component({
  selector: 'app-workspace',
  imports: [RouterOutlet, DropdownComponent],
  templateUrl: './workspace.component.html',
  styleUrl: './workspace.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceComponent {
  private readonly authService = inject(AuthService);
  private readonly tourService = inject(TourService);
  readonly payPeriodFilter = inject(PayPeriodFilterService);
  readonly preferences = inject(AppPreferencesService);
  readonly authError = this.authService.errorMessage;
  readonly currencyOptions = computed<DropdownOption[]>(() =>
    this.preferences.currencyOptions.map((currency) => ({
      value: currency,
      label: currency,
    })),
  );
  readonly payPeriodOptions = computed<DropdownOption[]>(() => [
    { value: ALL_PAY_PERIODS_KEY, label: 'All dates' },
    ...this.payPeriodFilter.options().map(({ period, key }) => ({
      value: key,
      label: `${this.payPeriodFilter.formatPeriod(period)} · ${this.preferences.formatCurrency(period.amount)}`,
    })),
  ]);

  selectPayPeriod(key: string): void {
    this.payPeriodFilter.select(key);
  }

  toggleTheme(): void {
    this.preferences.toggleTheme();
  }

  startPageTour(): void {
    this.tourService.startPageTour();
  }
}
