import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PlanningService } from './services/planning.service';
import { BillReminderService } from './services/bill-reminder.service';
import { SidebarComponent } from './layout/sidebar/sidebar.component';
import { WorkspaceComponent } from './layout/workspace/workspace.component';

@Component({
  selector: 'app-root',
  imports: [SidebarComponent, WorkspaceComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly planningService = inject(PlanningService);
  private readonly billReminderService = inject(BillReminderService);
}
