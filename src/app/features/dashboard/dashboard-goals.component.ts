import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppPreferencesService } from '../../services/app-preferences.service';
import type { SavingsGoal } from '../../types/planning.types';

@Component({
  selector: 'app-dashboard-goals',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-goals.component.html',
  styleUrl: './dashboard-goals.component.scss',
})
export class DashboardGoalsComponent {
  readonly preferences = inject(AppPreferencesService);
  readonly goals = input.required<SavingsGoal[]>();

  progress(goal: SavingsGoal): number {
    return goal.targetAmount > 0 ? Math.min(100, Math.round((goal.savedAmount / goal.targetAmount) * 100)) : 0;
  }
}
