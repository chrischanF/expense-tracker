import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BudgetProgressComponent } from '../../shared/budget-progress/budget-progress.component';
import type { CategoryBudget } from '../../types/planning.types';
import { AppPreferencesService } from '../../services/app-preferences.service';

export type DashboardBudget = CategoryBudget & { spent: number };

@Component({
  selector: 'app-dashboard-budgets',
  imports: [BudgetProgressComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-budgets.component.html',
  styleUrl: './dashboard-budgets.component.scss',
})
export class DashboardBudgetsComponent {
  readonly preferences = inject(AppPreferencesService);
  readonly budgets = input.required<DashboardBudget[]>();
}
