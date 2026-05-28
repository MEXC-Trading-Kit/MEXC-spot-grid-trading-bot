import type { MexcClient } from "../api/mexc/client.js";
import type { PriceTicker } from "../api/mexc/types.js";

export interface PriceUpdate {
  symbol: string;
  last: number;
  timestamp: number;
}

export class MarketDataService {
  constructor(private readonly client: MexcClient) {}

  async getLatestPrice(symbol: string): Promise<PriceUpdate> {
    const ticker: PriceTicker = await this.client.getPriceTicker(symbol);
    return this.parseTicker(ticker);
  }

  parseTicker(ticker: PriceTicker): PriceUpdate {
    return {
      symbol: ticker.symbol,
      last: Number(ticker.price),
      timestamp: Date.now(),
    };
  }
}
