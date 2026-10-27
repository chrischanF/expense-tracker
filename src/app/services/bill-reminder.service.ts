import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { AppPreferencesService } from './app-preferences.service';
import { PlanningService } from './planning.service';
import { getUpcomingBills } from './planning.model';

@Injectable({ providedIn: 'root' })
export class BillReminderService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly isSupported = signal(false);
  readonly permission = signal<NotificationPermission>('default');

  constructor(
    private readonly planning: PlanningService,
    private readonly preferences: AppPreferencesService,
  ) {
    if (!this.isBrowser || !('Notification' in window)) return;
    this.isSupported.set(true);
    this.permission.set(Notification.permission);
    effect(() => {
      const bills = this.planning.recurringTransactions();
      if (this.permission() === 'granted') this.notifyUpcoming(bills);
    });
    window.setInterval(() => {
      if (this.permission() === 'granted') this.notifyUpcoming(this.planning.recurringTransactions());
    }, 60 * 60 * 1000);
  }

  async enable(): Promise<void> {
    if (!this.isBrowser || !this.isSupported()) return;
    try {
      this.permission.set(await Notification.requestPermission());
      if (this.permission() === 'granted') this.notifyUpcoming(this.planning.recurringTransactions());
    } catch {
      this.permission.set('denied');
    }
  }

  private notifyUpcoming(recurring: ReturnType<PlanningService['recurringTransactions']>): void {
    const upcoming = getUpcomingBills(recurring, new Date(), 1);
    for (const bill of upcoming) {
      const key = `expense-tracker.bill-alert.${bill.id}.${bill.dueDate}`;
      try {
        if (localStorage.getItem(key)) continue;
        const dueText = bill.daysUntilDue === 0 ? 'is due today' : 'is due tomorrow';
        new Notification(`${bill.name} ${dueText}`, {
          body: `${this.preferences.formatCurrency(bill.amount, bill.currency || this.preferences.currency())} · ${bill.category}`,
          tag: key,
        });
        localStorage.setItem(key, 'sent');
      } catch {}
    }
  }
}