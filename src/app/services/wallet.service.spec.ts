import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { AppPreferencesService } from './app-preferences.service';
import { ExpenseService } from './expense.service';
import { ExchangeRateService } from './exchange-rate.service';
import { FirebaseService } from './firebase.service';
import { IncomeStreamService } from './income-stream.service';
import { WalletService } from './wallet.service';

const wallet = {
  id: 'main',
  name: 'Main account',
  bankCode: 'bpi' as const,
  accountType: 'savings' as const,
  initialBalance: 25_000,
  colorHex: '#B91C1C',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('WalletService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        WalletService,
        { provide: AuthService, useValue: { currentUser: signal(null) } },
        { provide: FirebaseService, useValue: { isOnline: () => false, isConfigured: false } },
        {
          provide: ExpenseService,
          useValue: {
            expenses: signal([{ id: 'expense-1', walletId: 'main', amount: 1_250, currency: 'PHP' }]),
            incomeProfile: signal({ payPeriods: [{ id: 'pay-period-1', walletId: 'main', amount: 2_000 }] }),
          },
        },
        {
          provide: IncomeStreamService,
          useValue: { streams: signal([{ id: 'income-1', walletId: 'main', amount: 5_000 }]) },
        },
        { provide: ExchangeRateService, useValue: { toBase: (amount: number) => amount } },
        { provide: AppPreferencesService, useValue: { currency: signal('PHP') } },
      ],
    });
  });

  it('computes wallet balance from opening funds, linked income, and linked expenses', () => {
    const service = TestBed.inject(WalletService);
    service.wallets.set([wallet]);

    expect(service.walletBalances()).toEqual([
      {
        wallet,
        initialBalance: 25_000,
        totalInflows: 7_000,
        totalExpenses: 1_250,
        remainingBalance: 30_750,
      },
    ]);
  });
});
