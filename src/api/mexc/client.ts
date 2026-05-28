import {
  buildSignedParams,
  encodeFormBody,
  toQueryString,
} from "./auth.js";
import type {
  AccountInfo,
  Balance,
  CancelOrderRequest,
  ExchangeInfo,
  MexcApiErrorBody,
  Order,
  PlaceOrderRequest,
  PlaceOrderResult,
  PriceTicker,
  SymbolInfo,
  SymbolPrecision,
  Ticker24hr,
} from "./types.js";
import { withRetry } from "../../utils/retry.js";

export interface MexcClientConfig {
  apiKey: string;
  secretKey: string;
  baseUrl?: string;
  recvWindow?: number;
}

export class MexcApiError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
  ) {
    super(message);
    this.name = "MexcApiError";
  }
}

const DEFAULT_BASE_URL = "https://api.mexc.com";

export class MexcClient {
  private readonly baseUrl: string;
  private readonly recvWindow: number;

  constructor(private readonly config: MexcClientConfig) {
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this.recvWindow = config.recvWindow ?? 5000;
  }

  private async request<T>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    params: Record<string, string | number | undefined> = {},
    signed = false,
  ): Promise<T> {
    let queryParams: Record<string, string> = {};
    let body: string | undefined;

    if (signed) {
      const signedParams = buildSignedParams(
        this.config.secretKey,
        params,
        Date.now(),
        this.recvWindow,
      );
      queryParams = signedParams;
    } else {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          queryParams[key] = String(value);
        }
      }
    }

    const headers: Record<string, string> = {};

    if (signed) {
      headers["X-MEXC-APIKEY"] = this.config.apiKey;
    }

    let url = `${this.baseUrl}${path}`;

    if (method === "GET" || method === "DELETE") {
      const qs = toQueryString(
        Object.fromEntries(
          Object.entries(queryParams).map(([k, v]) => [k, v]),
        ),
      );
      if (qs) {
        url += `?${qs}`;
      }
    } else {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      body = encodeFormBody(queryParams);
    }

    const response = await fetch(url, {
      method,
      headers,
      body,
    });

    const text = await response.text();
    let json: T & MexcApiErrorBody | null = null;

    if (text) {
      try {
        json = JSON.parse(text) as T & MexcApiErrorBody;
      } catch {
        throw new Error(`Invalid JSON response (${response.status}): ${text}`);
      }
    }

    if (!response.ok) {
      const message =
        json?.msg ?? text ?? `HTTP ${response.status}`;
      throw new MexcApiError(message, json?.code ?? response.status);
    }

    if (json && typeof json === "object" && "code" in json && json.code !== undefined && json.code !== 0 && json.code !== 200) {
      throw new MexcApiError(json.msg ?? "MEXC API error", json.code);
    }

    return json as T;
  }

  async ping(): Promise<Record<string, never>> {
    return this.request("GET", "/api/v3/ping");
  }

  async getServerTime(): Promise<{ serverTime: number }> {
    return this.request("GET", "/api/v3/time");
  }

  async getPriceTicker(symbol: string): Promise<PriceTicker> {
    return this.request("GET", "/api/v3/ticker/price", { symbol });
  }

  async getTicker24hr(symbol: string): Promise<Ticker24hr> {
    return this.request("GET", "/api/v3/ticker/24hr", { symbol });
  }

  async getExchangeInfo(symbol?: string): Promise<ExchangeInfo> {
    return this.request("GET", "/api/v3/exchangeInfo", symbol ? { symbol } : {});
  }

  async getSymbolInfo(symbol: string): Promise<SymbolInfo> {
    const info = await this.getExchangeInfo(symbol);
    const found = info.symbols.find((s) => s.symbol === symbol);
    if (!found) {
      throw new Error(`Symbol not found: ${symbol}`);
    }
    if (!found.isSpotTradingAllowed) {
      throw new Error(`Spot trading not allowed for ${symbol}`);
    }
    return found;
  }

  extractPrecision(symbolInfo: SymbolInfo): SymbolPrecision {
    const priceFilter = symbolInfo.filters.find((f) => f.filterType === "PRICE_FILTER");
    const lotFilter = symbolInfo.filters.find((f) => f.filterType === "LOT_SIZE");
    const notionalFilter = symbolInfo.filters.find(
      (f) => f.filterType === "MIN_NOTIONAL" || f.filterType === "NOTIONAL",
    );

    return {
      tickSize: priceFilter?.tickSize ?? "0.01",
      stepSize: lotFilter?.stepSize ?? "0.00001",
      minQty: lotFilter?.minQty ?? "0.00001",
      minNotional: notionalFilter?.minNotional,
    };
  }

  async getOpenOrders(symbol: string): Promise<Order[]> {
    return this.request("GET", "/api/v3/openOrders", { symbol }, true);
  }

  async placeOrder(order: PlaceOrderRequest): Promise<PlaceOrderResult> {
    const side = order.side.toUpperCase() as "BUY" | "SELL";

    return withRetry(
      () =>
        this.request<PlaceOrderResult>(
          "POST",
          "/api/v3/order",
          {
            symbol: order.symbol,
            side,
            type: "LIMIT",
            quantity: order.quantity,
            price: order.price,
            newClientOrderId: order.clientOrderId,
          },
          true,
        ),
      {
        shouldRetry: (err) =>
          err instanceof MexcApiError &&
          [429, 500, 503, 504].includes(err.code ?? 0),
      },
    );
  }

  async cancelOrder(req: CancelOrderRequest): Promise<Order> {
    return this.request(
      "DELETE",
      "/api/v3/order",
      {
        symbol: req.symbol,
        orderId: req.orderId,
        origClientOrderId: req.clientOrderId,
      },
      true,
    );
  }

  async cancelAllOrders(symbol: string): Promise<void> {
    const orders = await this.getOpenOrders(symbol);
    await Promise.all(
      orders.map((order) =>
        this.cancelOrder({ symbol, orderId: order.orderId }),
      ),
    );
  }

  async getAccount(): Promise<AccountInfo> {
    return this.request("GET", "/api/v3/account", {}, true);
  }

  async getBalance(asset?: string): Promise<Balance[]> {
    const account = await this.getAccount();
    if (!asset) {
      return account.balances.filter(
        (b) => Number(b.free) > 0 || Number(b.locked) > 0,
      );
    }
    return account.balances.filter((b) => b.asset === asset);
  }
}
