import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppPreferencesService } from '../../services/app-preferences.service';
import { AuthService } from '../../services/auth.service';
import { TourService } from '../../services/tour.service';
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
  readonly preferences = inject(AppPreferencesService);
  readonly authError = this.authService.errorMessage;
  readonly currencyOptions = computed<DropdownOption[]>(() =>
    this.preferences.currencyOptions.map((currency) => ({
      value: currency,
      label: currency,
    })),
  );

  toggleTheme(): void {
    this.preferences.toggleTheme();
  }

  startPageTour(): void {
    this.tourService.startPageTour();
  }
}
