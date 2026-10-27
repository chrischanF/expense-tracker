import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppPreferencesService } from '../../services/app-preferences.service';
import { PlanningService } from '../../services/planning.service';
import type { SavingsGoal } from '../../types/planning.types';
import { LoaderComponent } from '../../shared/loader/loader.component';

@Component({
  selector: 'app-goals-page',
  imports: [DatePipe, FormsModule, LoaderComponent],
  templateUrl: './goals.page.html',
  styleUrl: './goals.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoalsPage {
  private readonly planning = inject(PlanningService);
  readonly preferences = inject(AppPreferencesService);
  readonly firestoreBusy = computed(() => this.planning.isLoading() || this.planning.isSaving());
  readonly firestoreLoaderMessage = computed(() =>
    this.planning.isLoading() ? 'Loading savings goals…' : 'Syncing your changes…',
  );
  readonly goals = this.planning.goals;
  readonly totalTarget = computed(() => this.goals().reduce((total, goal) => total + goal.targetAmount, 0));
  readonly totalSaved = computed(() => this.goals().reduce((total, goal) => total + goal.savedAmount, 0));
  readonly contributions = signal<Record<string, string>>({});

  readonly name = signal('');
  readonly targetAmount = signal('');
  readonly monthlyContribution = signal('');
  readonly targetDate = signal('');

  createGoal(): void {
    const targetAmount = Number(this.targetAmount());
    if (!this.name().trim() || !Number.isFinite(targetAmount) || targetAmount <= 0) return;
    this.planning.addGoal({
      name: this.name().trim(),
      targetAmount,
      monthlyContribution: Number(this.monthlyContribution()) || 0,
      targetDate: this.targetDate(),
    });
    this.name.set('');
    this.targetAmount.set('');
    this.monthlyContribution.set('');
    this.targetDate.set('');
  }

  updateContribution(id: string, value: string): void {
    this.contributions.update((current) => ({ ...current, [id]: value }));
  }

  contribute(goal: SavingsGoal): void {
    const amount = Number(this.contributions()[goal.id]);
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.planning.contributeToGoal(goal.id, amount);
    this.updateContribution(goal.id, '');
  }

  deleteGoal(id: string): void {
    this.planning.deleteGoal(id);
  }

  progress(goal: SavingsGoal): number {
    return goal.targetAmount > 0 ? Math.min(100, Math.round((goal.savedAmount / goal.targetAmount) * 100)) : 0;
  }

  formatCurrency(amount: number): string {
    return this.preferences.formatCurrency(amount);
  }
}
