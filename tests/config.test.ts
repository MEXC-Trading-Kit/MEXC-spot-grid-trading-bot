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
    process.env.GRID_MODE = "arithmetic";
    process.env.GRID_LOWER_PRICE = "60000";
    process.env.GRID_UPPER_PRICE = "70000";
    process.env.GRID_LEVELS = "10";
    process.env.GRID_ORDER_SIZE = "0.001";
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("loads valid configuration", () => {
    const config = loadConfig();
    expect(config.trading.symbol).toBe("BTCUSDT");
    expect(config.trading.levels).toBe(10);
    expect(config.mexc.baseUrl).toBe("https://api.mexc.com");
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
