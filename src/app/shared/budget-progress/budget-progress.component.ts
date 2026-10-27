import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { getBudgetStatus } from '../../services/planning.model';

@Component({
  selector: 'app-budget-progress',
  templateUrl: './budget-progress.component.html',
  styleUrl: './budget-progress.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetProgressComponent {
  @Input() label = 'Budget usage';
  @Input() spent = 0;
  @Input() limit = 0;

  get percent(): number {
    return this.limit > 0 ? Math.min(100, Math.max(0, Math.round(this.spent / this.limit * 100))) : 0;
  }

  get status(): string {
    return getBudgetStatus(this.spent, this.limit);
  }
}