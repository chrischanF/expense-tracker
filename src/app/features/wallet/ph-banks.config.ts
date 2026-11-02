import type { WalletBankCode } from '../../models/wallet.model';

export interface BankPreset {
  code: WalletBankCode;
  name: string;
  primary: string;
  secondary: string;
}

export const PH_BANK_PRESETS: BankPreset[] = [
  { code: 'unionbank', name: 'UnionBank', primary: '#FF6B00', secondary: '#1E293B' },
  { code: 'bdo', name: 'BDO', primary: '#002B66', secondary: '#FACC15' },
  { code: 'bpi', name: 'BPI', primary: '#B91C1C', secondary: '#EAB308' },
  { code: 'metrobank', name: 'Metrobank', primary: '#1E40AF', secondary: '#06B6D4' },
  { code: 'pnb', name: 'PNB', primary: '#991B1B', secondary: '#FFFFFF' },
  { code: 'landbank', name: 'Landbank', primary: '#15803D', secondary: '#CA8A04' },
  { code: 'rcbc', name: 'RCBC', primary: '#0284C7', secondary: '#0F172A' },
  { code: 'securitybank', name: 'Security Bank', primary: '#0891B2', secondary: '#0F172A' },
  { code: 'gcash', name: 'GCash', primary: '#0052FF', secondary: '#FFFFFF' },
  { code: 'maya', name: 'Maya', primary: '#00D632', secondary: '#09090B' },
  { code: 'maribank', name: 'MariBank', primary: '#00A896', secondary: '#FF5722' },
  { code: 'gotyme', name: 'GoTyme', primary: '#00F0FF', secondary: '#7C3AED' },
  { code: 'seabank', name: 'SeaBank', primary: '#FF5200', secondary: '#FFFFFF' },
  { code: 'cash', name: 'Cash Wallet', primary: '#059669', secondary: '#064E3B' },
  { code: 'other', name: 'Other', primary: '#475569', secondary: '#0F172A' },
];
