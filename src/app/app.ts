import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DropdownComponent, type DropdownOption } from './shared/dropdown/dropdown.component';
import { AuthService } from './services/auth.service';
import { ExpenseService } from './services/expense.service';
import { FirebaseService } from './services/firebase.service';
import { AppPreferencesService } from './services/app-preferences.service';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, DropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
})
export class App {
  private readonly authService = inject(AuthService);
  private readonly firebaseService = inject(FirebaseService);
  private readonly expenseService = inject(ExpenseService);
  readonly preferences = inject(AppPreferencesService);
  readonly currencyOptions = computed<DropdownOption[]>(() => this.preferences.currencyOptions.map((currency) => ({
    value: currency,
    label: currency,
  })));

  readonly currentUser = this.authService.currentUser;
  readonly authError = this.authService.errorMessage;
  readonly syncStatus = this.expenseService.syncStatus;
  readonly isOnline = this.firebaseService.isOnline;

  signIn(): void {
    void this.authService.signInWithGoogle();
  }

  signOut(): void {
    void this.authService.signOut();
  }

  toggleTheme(): void {
    this.preferences.toggleTheme();
  }
}
