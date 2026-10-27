export interface ExchangeRateResponse {
  result: string;
  base_code: string;
  time_last_update_unix: number;
  rates: Record<string, number>;
}

export interface CachedRates {
  base: string;
  updatedAt: number;
  rates: Record<string, number>;
}
