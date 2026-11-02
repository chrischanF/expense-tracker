import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { AppPreferencesService } from '../../services/app-preferences.service';
import type { UpcomingBill } from '../../types/planning.types';

@Component({
  selector: 'app-dashboard-reminders',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-reminders.component.html',
  styleUrl: './dashboard-reminders.component.scss',
})
export class DashboardRemindersComponent {
  readonly preferences = inject(AppPreferencesService);
  readonly bills = input.required<UpcomingBill[]>();
  readonly remindersSupported = input.required<boolean>();
  readonly reminderPermission = input.required<NotificationPermission>();
  readonly enableReminders = output<void>();
}
