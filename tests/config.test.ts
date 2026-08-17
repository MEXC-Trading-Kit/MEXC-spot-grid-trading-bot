import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig, normalizeSymbol } from "../src/config/index.js";

describe("normalizeSymbol", () => {
  it("normalizes common formats", () => {
    expect(normalizeSymbol("btc-usdt")).toBe("BTCUSDT");
    expect(normalizeSymbol("BTC_USDT")).toBe("BTCUSDT");
    expect(normalizeSymbol("BTCUSDT")).toBe("BTCUSDT");
  });
});

describe("loadConfig", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env.MEXC_API_KEY = "test-key";
    process.env.MEXC_SECRET_KEY = "test-secret";
    process.env.MEXC_SYMBOL = "BTC-USDT";
    process.env.GRID_MODE = "geometric";
    process.env.GRID_LOWER_PRICE = "57500";
    process.env.GRID_UPPER_PRICE = "69800";
    process.env.GRID_LEVELS = "8";
    process.env.GRID_ORDER_SIZE = "0.012";
    process.env.MAX_QUOTE_EXPOSURE = "6500";
    process.env.STOP_LOSS_PRICE = "55800";
    process.env.TAKE_PROFIT_PRICE = "72000";
    process.env.POLL_INTERVAL_MS = "5000";
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("loads valid configuration", () => {
    const config = loadConfig();
    expect(config.trading.symbol).toBe("BTCUSDT");
    expect(config.trading.gridMode).toBe("geometric");
    expect(config.trading.lowerPrice).toBe(57500);
    expect(config.trading.upperPrice).toBe(69800);
    expect(config.trading.levels).toBe(8);
    expect(config.trading.orderSize).toBe(0.012);
    expect(config.trading.maxQuoteExposure).toBe(6500);
    expect(config.trading.stopLossPrice).toBe(55800);
    expect(config.trading.takeProfitPrice).toBe(72000);
    expect(config.trading.pollIntervalMs).toBe(5000);
    expect(config.mexc.baseUrl).toBe("https://api.mexc.com");
  });

  it("applies shipped desk fallbacks when grid env is omitted", () => {
    delete process.env.GRID_MODE;
    delete process.env.GRID_LOWER_PRICE;
    delete process.env.GRID_UPPER_PRICE;
    delete process.env.GRID_LEVELS;
    delete process.env.GRID_ORDER_SIZE;
    delete process.env.MAX_QUOTE_EXPOSURE;
    delete process.env.STOP_LOSS_PRICE;
    delete process.env.TAKE_PROFIT_PRICE;
    delete process.env.POLL_INTERVAL_MS;
    delete process.env.MEXC_SYMBOL;

    const config = loadConfig();
    expect(config.trading.symbol).toBe("BTCUSDT");
    expect(config.trading.gridMode).toBe("geometric");
    expect(config.trading.lowerPrice).toBe(57500);
    expect(config.trading.upperPrice).toBe(69800);
    expect(config.trading.levels).toBe(8);
    expect(config.trading.orderSize).toBe(0.012);
    expect(config.trading.maxQuoteExposure).toBe(6500);
    expect(config.trading.stopLossPrice).toBe(55800);
    expect(config.trading.takeProfitPrice).toBe(72000);
    expect(config.trading.pollIntervalMs).toBe(5000);
  });

  it("rejects when lower >= upper", () => {
    process.env.GRID_LOWER_PRICE = "70000";
    process.env.GRID_UPPER_PRICE = "60000";
    expect(() => loadConfig()).toThrow("GRID_LOWER_PRICE");
  });

  it("supports dry run override", () => {
    const config = loadConfig({ dryRun: true });
    expect(config.trading.dryRun).toBe(true);
  });
});
