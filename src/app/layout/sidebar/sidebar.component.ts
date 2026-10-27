import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ExpenseService } from '../../services/expense.service';
import { FirebaseService } from '../../services/firebase.service';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  private readonly authService = inject(AuthService);
  private readonly firebaseService = inject(FirebaseService);
  private readonly expenseService = inject(ExpenseService);

  readonly currentUser = this.authService.currentUser;
  readonly syncStatus = this.expenseService.syncStatus;
  readonly isOnline = this.firebaseService.isOnline;

  signIn(): void {
    void this.authService.signInWithGoogle();
  }

  signOut(): void {
    void this.authService.signOut();
  }
}
