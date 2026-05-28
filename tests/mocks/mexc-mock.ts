import type { MexcClient } from "../../src/api/mexc/client.js";
import type {
  AccountInfo,
  Balance,
  Order,
  PlaceOrderRequest,
  PlaceOrderResult,
  PriceTicker,
  SymbolInfo,
} from "../../src/api/mexc/types.js";

export function createMockMexcClient(overrides?: {
  lastPrice?: number;
  tickSize?: string;
  stepSize?: string;
}): MexcClient {
  const lastPrice = overrides?.lastPrice ?? 65_000;
  const orders: Order[] = [];

  const symbolInfo: SymbolInfo = {
    symbol: "BTCUSDT",
    status: "1",
    baseAsset: "BTC",
    quoteAsset: "USDT",
    baseAssetPrecision: 8,
    quoteAssetPrecision: 8,
    quotePrecision: 8,
    isSpotTradingAllowed: true,
    filters: [
      {
        filterType: "PRICE_FILTER",
        tickSize: overrides?.tickSize ?? "0.01",
      },
      {
        filterType: "LOT_SIZE",
        stepSize: overrides?.stepSize ?? "0.00001",
        minQty: "0.00001",
      },
    ],
  };

  const mock = {
    ping: async () => ({}),
    getServerTime: async () => ({ serverTime: Date.now() }),
    getPriceTicker: async (symbol: string): Promise<PriceTicker> => ({
      symbol,
      price: String(lastPrice),
    }),
    getSymbolInfo: async (): Promise<SymbolInfo> => symbolInfo,
    extractPrecision: () => ({
      tickSize: overrides?.tickSize ?? "0.01",
      stepSize: overrides?.stepSize ?? "0.00001",
      minQty: "0.00001",
    }),
    getOpenOrders: async (): Promise<Order[]> => [...orders],
    placeOrder: async (req: PlaceOrderRequest): Promise<PlaceOrderResult> => {
      const orderId = Date.now();
      orders.push({
        symbol: req.symbol,
        orderId,
        orderListId: -1,
        clientOrderId: req.clientOrderId ?? String(orderId),
        price: req.price,
        origQty: req.quantity,
        executedQty: "0",
        cummulativeQuoteQty: "0",
        status: "NEW",
        type: "LIMIT",
        side: req.side.toUpperCase() as "BUY" | "SELL",
        time: Date.now(),
        updateTime: Date.now(),
      });
      return {
        symbol: req.symbol,
        orderId,
        clientOrderId: req.clientOrderId ?? String(orderId),
        transactTime: Date.now(),
        price: req.price,
        origQty: req.quantity,
        type: "LIMIT",
        side: req.side.toUpperCase() as "BUY" | "SELL",
      };
    },
    cancelOrder: async (): Promise<Order> => {
      orders.length = 0;
      return orders[0] as unknown as Order;
    },
    cancelAllOrders: async (): Promise<void> => {
      orders.length = 0;
    },
    getBalance: async (): Promise<Balance[]> => [
      { asset: "USDT", free: "10000", locked: "0" },
    ],
    getAccount: async (): Promise<AccountInfo> => ({
      balances: [{ asset: "USDT", free: "10000", locked: "0" }],
      canTrade: true,
      canWithdraw: true,
      canDeposit: true,
      updateTime: Date.now(),
    }),
  };

  return mock as unknown as MexcClient;
}
