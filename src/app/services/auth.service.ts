import { Injectable, signal } from '@angular/core';
import type { Auth } from 'firebase/auth';
import { FirebaseService } from './firebase.service';

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly currentUser = signal<AppUser | null>(null);
  readonly errorMessage = signal('');

  constructor(private readonly firebase: FirebaseService) {
    void this.observeAuthState();
  }

  async signInWithGoogle(): Promise<void> {
    const auth = await this.firebase.getAuth();
    if (!auth) {
      this.errorMessage.set('Firebase is not configured. Add your Firebase project settings to environment.ts.');
      return;
    }

    this.errorMessage.set('');
    try {
      const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch {
      this.errorMessage.set('Could not sign in with Google. Check your connection and Firebase Authentication settings.');
    }
  }

  async signOut(): Promise<void> {
    this.errorMessage.set('');
    const auth = await this.firebase.getAuth();
    if (auth) {
      const { signOut } = await import('firebase/auth');
      await signOut(auth);
    }
  }

  private async observeAuthState(): Promise<void> {
    const auth = await this.firebase.getAuth();
    if (!auth) {
      return;
    }

    const { onAuthStateChanged } = await import('firebase/auth');
    onAuthStateChanged(auth, (user) => {
      this.currentUser.set(user ? {
        uid: user.uid,
        email: user.email ?? '',
        displayName: user.displayName ?? '',
      } : null);
    });
  }
}
