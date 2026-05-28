import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppConfig } from "../src/config/index.js";
import { createLogger } from "../src/services/logger.js";
import { GridEngine } from "../src/strategies/grid/grid-engine.js";
import { createMockMexcClient } from "./mocks/mexc-mock.js";

function buildTestConfig(dryRun = true): AppConfig {
  return {
    mexc: {
      apiKey: "test",
      secretKey: "test",
      baseUrl: "https://api.mexc.com",
    },
    trading: {
      symbol: "BTCUSDT",
      gridMode: "arithmetic",
      lowerPrice: 64_000,
      upperPrice: 66_000,
      levels: 5,
      orderSize: 0.001,
      maxQuoteExposure: 500,
      pollIntervalMs: 60_000,
      dryRun,
    },
    logLevel: "fatal",
  };
}

describe("GridEngine", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env.LOG_LEVEL = "fatal";
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("initializes and builds grid levels", async () => {
    const client = createMockMexcClient({ lastPrice: 65_000 });
    const engine = new GridEngine(client, buildTestConfig(), createLogger("fatal"));

    await engine.initialize();
    const levels = engine.getLevels();

    expect(levels).toHaveLength(5);
    expect(levels[0]!.price).toBe(64_000);
    expect(levels[4]!.price).toBe(66_000);
  });

  it("deploys initial grid in dry run", async () => {
    const client = createMockMexcClient({ lastPrice: 65_000 });
    const engine = new GridEngine(client, buildTestConfig(true), createLogger("fatal"));

    await engine.initialize();
    await engine.deployInitialGrid();

    const stats = engine.getStats();
    expect(stats.activeOrders).toBeGreaterThan(0);
    expect(stats.totalBuys + stats.totalSells).toBeGreaterThan(0);
  });

  it("rebalances after simulated fill", async () => {
    const client = createMockMexcClient({ lastPrice: 65_000 });
    const engine = new GridEngine(client, buildTestConfig(true), createLogger("fatal"));

    await engine.initialize();
    await engine.deployInitialGrid();

    const before = engine.getStats().profitCycles;
    await engine.onOrderFilled(1, "buy");
    const after = engine.getStats().profitCycles;

    expect(after).toBe(before + 1);
  });

  it("stops polling cleanly", async () => {
    const client = createMockMexcClient({ lastPrice: 65_000 });
    const engine = new GridEngine(client, buildTestConfig(true), createLogger("fatal"));

    await engine.initialize();
    engine.startPolling();
    engine.stop();
    await engine.shutdown(false);

    expect(engine.getStats().activeOrders).toBeGreaterThanOrEqual(0);
  });
});
