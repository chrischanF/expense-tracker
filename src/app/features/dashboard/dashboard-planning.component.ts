import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { AppPreferencesService } from '../../services/app-preferences.service';
import type { SafeToSpendPlan } from '../../types/planning.types';
import type { IncomeProfile } from '../../types/income.types';

@Component({
  selector: 'app-dashboard-planning',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-planning.component.html',
  styleUrl: './dashboard-planning.component.scss',
})
export class DashboardPlanningComponent {
  readonly preferences = inject(AppPreferencesService);
  readonly safeToSpend = input.required<SafeToSpendPlan>();
  readonly safeToSpendAmount = input.required<number>();
  readonly safeToSpendRatio = input.required<number>();
  readonly allowancePeriod = input.required<'daily' | 'weekly'>();
  readonly incomeProfile = input.required<IncomeProfile>();
  readonly paydayAmount = input.required<number>();
  readonly exchangeRateLoading = input(false);
  readonly exchangeRateError = input<string | null>(null);
  readonly allowancePeriodChange = output<'daily' | 'weekly'>();

  daysUntilPayday(): number {
    const payday = new Date(`${this.incomeProfile().nextPayDate.slice(0, 10)}T12:00:00`);
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return Number.isNaN(payday.getTime())
      ? 0
      : Math.max(0, Math.ceil((payday.getTime() - todayStart.getTime()) / 86_400_000));
  }
}
