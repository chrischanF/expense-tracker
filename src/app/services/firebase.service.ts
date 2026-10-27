import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class FirebaseService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly isOnline = signal(this.isBrowser ? navigator.onLine : false);
  readonly isConfigured = this.hasFirebaseConfig();
  private appPromise: Promise<FirebaseApp | null> | null = null;
  private authPromise: Promise<Auth | null> | null = null;
  private firestorePromise: Promise<Firestore | null> | null = null;

  constructor() {
    if (this.isBrowser) {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }
  }

  private readonly handleOnline = (): void => this.isOnline.set(true);
  private readonly handleOffline = (): void => this.isOnline.set(false);

  getAuth(): Promise<Auth | null> {
    this.authPromise ??= this.getApp().then(async (app) => {
      if (!app) {
        return null;
      }
      const { getAuth } = await import('firebase/auth');
      return getAuth(app);
    });
    return this.authPromise;
  }

  getFirestore(): Promise<Firestore | null> {
    this.firestorePromise ??= this.getApp().then(async (app) => {
      if (!app) {
        return null;
      }
      const { getFirestore } = await import('firebase/firestore');
      return getFirestore(app);
    });
    return this.firestorePromise;
  }

  private hasFirebaseConfig(): boolean {
    const config = environment.firebaseConfig;
    return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
  }

  private getApp(): Promise<FirebaseApp | null> {
    this.appPromise ??= this.initializeApp();
    return this.appPromise;
  }

  private async initializeApp(): Promise<FirebaseApp | null> {
    if (!this.isBrowser || !this.hasFirebaseConfig()) {
      return null;
    }

    try {
      const { initializeApp } = await import('firebase/app');
      return initializeApp(environment.firebaseConfig);
    } catch {
      return null;
    }
  }
}