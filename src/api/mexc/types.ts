export type OrderSide = "buy" | "sell";
export type MexcOrderSide = "BUY" | "SELL";

export type OrderState =
  | "NEW"
  | "PARTIALLY_FILLED"
  | "FILLED"
  | "CANCELED"
  | "PENDING_CANCEL"
  | "REJECTED"
  | "EXPIRED";

export interface MexcApiErrorBody {
  code?: number;
  msg?: string;
}

export interface PriceTicker {
  symbol: string;
  price: string;
}

export interface BookTicker {
  symbol: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
}

export interface Ticker24hr extends PriceTicker {
  lastPrice: string;
  bidPrice: string;
  askPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
}

export interface SymbolFilter {
  filterType: string;
  minPrice?: string;
  maxPrice?: string;
  tickSize?: string;
  minQty?: string;
  maxQty?: string;
  stepSize?: string;
  minNotional?: string;
}

export interface SymbolInfo {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  baseAssetPrecision: number;
  quoteAssetPrecision: number;
  quotePrecision: number;
  isSpotTradingAllowed: boolean;
  filters: SymbolFilter[];
}

export interface ExchangeInfo {
  timezone: string;
  serverTime: number;
  symbols: SymbolInfo[];
}

export interface Order {
  symbol: string;
  orderId: number;
  orderListId: number;
  clientOrderId: string;
  price: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  status: OrderState;
  type: string;
  side: MexcOrderSide;
  time: number;
  updateTime: number;
}

export interface PlaceOrderRequest {
  symbol: string;
  side: OrderSide;
  quantity: string;
  price: string;
  clientOrderId?: string;
}

export interface PlaceOrderResult {
  symbol: string;
  orderId: number;
  clientOrderId: string;
  transactTime: number;
  price: string;
  origQty: string;
  type: string;
  side: MexcOrderSide;
}

export interface CancelOrderRequest {
  symbol: string;
  orderId?: number;
  clientOrderId?: string;
}

export interface Balance {
  asset: string;
  free: string;
  locked: string;
}

export interface AccountInfo {
  balances: Balance[];
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  updateTime: number;
}

export interface SymbolPrecision {
  tickSize: string;
  stepSize: string;
  minQty: string;
  minNotional?: string;
}
