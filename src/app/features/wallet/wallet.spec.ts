import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppPreferencesService } from '../../services/app-preferences.service';
import { WalletService } from '../../services/wallet.service';
import { Wallet } from './wallet';

describe('Wallet', () => {
  let component: Wallet;
  let fixture: ComponentFixture<Wallet>;

  beforeEach(async () => {
    const walletServiceStub = {
      wallets: signal([]),
      walletBalances: signal([]),
      selectedWalletId: signal(null),
      selectedWallet: signal(null),
      selectWallet: vi.fn(),
      getWallets: vi.fn(() => []),
      addWallet: vi.fn(),
      updateWallet: vi.fn(),
      deleteWallet: vi.fn(),
    };
    const preferencesStub = {
      currency: signal('PHP'),
      formatCurrency: (value: number) => `PHP ${value.toFixed(2)}`,
    };
    await TestBed.configureTestingModule({
      imports: [Wallet],
      providers: [
        { provide: WalletService, useValue: walletServiceStub },
        { provide: AppPreferencesService, useValue: preferencesStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Wallet);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
