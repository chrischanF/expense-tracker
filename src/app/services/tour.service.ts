import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import type { DriveStep, Driver } from 'driver.js';

const INTRO_SEEN_KEY = 'ledger.tour.intro-seen.v1';

@Injectable({ providedIn: 'root' })
export class TourService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private activeTour: Driver | null = null;
  private introScheduled = false;
  private introSeenThisSession = false;

  constructor() {
    if (!this.isBrowser) return;
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.scheduleIntroTour());
    if (this.router.navigated) this.scheduleIntroTour();
  }

  startPageTour(): void {
    if (!this.isBrowser) return;
    const route = this.router.url.split('?')[0].replace(/\/$/, '') || '/dashboard';
    const steps = this.pageSteps(route);
    void this.present(steps);
  }

  private scheduleIntroTour(): void {
    if (!this.isBrowser || this.introScheduled || this.hasSeenIntro()) return;
    this.introScheduled = true;
    window.setTimeout(() => {
      this.introScheduled = false;
      if (this.hasSeenIntro()) return;
      this.markIntroSeen();
      void this.present(this.introSteps());
    }, 250);
  }

  private async present(steps: DriveStep[]): Promise<void> {
    const availableSteps = steps.filter((step) => {
      if (typeof step.element !== 'string') return true;
      return document.querySelector(step.element) !== null;
    });
    if (!availableSteps.length) return;

    this.activeTour?.destroy();
    const { driver } = await import('driver.js');
    this.activeTour = driver({
      steps: availableSteps,
      animate: true,
      smoothScroll: true,
      allowClose: true,
      showProgress: true,
      popoverClass: 'ledger-tour-popover',
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      doneBtnText: 'Finish',
      closeBtnLabel: 'Close tour',
      overlayOpacity: 0.58,
      stagePadding: 8,
      stageRadius: 9,
      progressText: '{{current}} of {{total}}',
    });
    this.activeTour.drive();
  }

  private introSteps(): DriveStep[] {
    return [
      {
        element: '.main-nav',
        popover: { title: 'Your finance workspace', description: 'Move between your overview, transactions, insights, income, recurring bills, budgets, and savings goals.' },
      },
      {
        element: '.page-intro',
        popover: { title: 'A focused view for each task', description: 'Each section keeps its controls and information together. Use the Tour button anytime for a walkthrough of the current page.' },
      },
      {
        element: '.sidebar-add',
        popover: { title: 'Record an expense', description: 'Add a transaction here. Active recurring commitments are also added to your ledger automatically on their due day.' },
      },
      {
        element: '[data-tour="global-tools"]',
        popover: { title: 'Make it yours', description: 'Set your display currency, switch the color theme, or replay this page’s tour from the help button.' },
      },
      {
        element: '[data-tour="page-tour-button"]',
        popover: { title: 'Guidance when you need it', description: 'This button opens a walkthrough tailored to whichever page you are viewing.' },
      },
    ];
  }

  private pageSteps(route: string): DriveStep[] {
    const steps: Record<string, DriveStep[]> = {
      '/dashboard': [
        { element: '.stats-grid', popover: { title: 'Monthly overview', description: 'Review income, spending, remaining balance, and your next payday at a glance.' } },
        { element: '.dashboard-budgets', popover: { title: 'Budget progress', description: 'Category progress changes color as spending approaches or exceeds each monthly limit.' } },
        { element: '.dashboard-grid', popover: { title: 'Recent activity and income', description: 'Check recent expenses and the income schedule used for your monthly baseline.' } },
      ],
      '/transactions': [
        { element: '.page-intro', popover: { title: 'Manage transactions', description: 'Add an expense to the ledger or edit existing entries.' } },
        { element: '.transaction-tools', popover: { title: 'Filter and export', description: 'Choose a date range, then export the visible transaction list as CSV.' } },
        { element: '.transactions-panel', popover: { title: 'Your ledger', description: 'Review, edit, or remove recorded transactions here.' } },
      ],
      '/analytics': [
        { element: '.source-filter', popover: { title: 'Filter by source', description: 'Focus the charts on a payment source or compare all sources.' } },
        { element: '.analytics-grid', popover: { title: 'Spending patterns', description: 'Explore the category breakdown and switch the trend between the last 30 days and 12 months.' } },
      ],
      '/income': [
        { element: '.income-form', popover: { title: 'Set your income schedule', description: 'Enter your pay amount, frequency, and next payday to establish a monthly baseline.' } },
        { element: '.income-projection', popover: { title: 'Monthly projection', description: 'This estimate normalizes your pay schedule across a full year.' } },
      ],
      '/recurring': [
        { element: '.recurring-editor', popover: { title: 'Add a monthly commitment', description: 'Set the expected amount, category, payment source, and day of the month.' } },
        { element: '.recurring-list', popover: { title: 'Manage recurring expenses', description: 'Pause, resume, edit, or remove commitments. Active items create one ledger entry per month after their due day.' } },
      ],
      '/budgets': [
        { element: '.budget-editor', popover: { title: 'Set a category limit', description: 'Choose a category and monthly cap. Saving an existing category updates its limit.' } },
        { element: '.budget-list', popover: { title: 'Track your pace', description: 'Progress bars compare this month’s category spending to each saved limit.' } },
      ],
      '/goals': [
        { element: '.goal-editor', popover: { title: 'Create a savings target', description: 'Name a goal, enter its target amount, and optionally set a target date.' } },
        { element: '.goal-list', popover: { title: 'Add contributions', description: 'Record contributions to move each goal forward and review its progress.' } },
      ],
    };
    return steps[route] ?? this.introSteps();
  }

  private hasSeenIntro(): boolean {
    if (this.introSeenThisSession) return true;
    try {
      return window.localStorage.getItem(INTRO_SEEN_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private markIntroSeen(): void {
    this.introSeenThisSession = true;
    try {
      window.localStorage.setItem(INTRO_SEEN_KEY, 'true');
    } catch {
      // Keep the intro from repeating during this session if storage is unavailable.
    }
  }
}