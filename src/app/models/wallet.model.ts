export type WalletBankCode =
  | 'unionbank'
  | 'bdo'
  | 'bpi'
  | 'metrobank'
  | 'pnb'
  | 'rcbc'
  | 'securitybank'
  | 'landbank'
  | 'gcash'
  | 'maya'
  | 'maribank'
  | 'gotyme'
  | 'seabank'
  | 'cash'
  | 'other';

export type WalletAccountType = 'savings' | 'checking' | 'credit' | 'wallet' | 'cash';

export interface Wallet {
  id: string;
  name: string;
  bankCode: WalletBankCode;
  accountType: WalletAccountType;
  initialBalance: number;
  accountNumberLast4?: string;
  colorHex: string;
  createdAt: string;
}

export interface WalletBalance {
  wallet: Wallet;
  initialBalance: number;
  totalInflows: number;
  totalExpenses: number;
  remainingBalance: number;
}
