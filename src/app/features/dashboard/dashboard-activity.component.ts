import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AppPreferencesService } from '../../services/app-preferences.service';
import type { ExpenseItem } from '../../types/analytics.types';

@Component({
  selector: 'app-dashboard-activity',
  imports: [DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-activity.component.html',
  styleUrl: './dashboard-activity.component.scss',
})
export class DashboardActivityComponent {
  readonly preferences = inject(AppPreferencesService);
  readonly expenses = input.required<ExpenseItem[]>();
}
