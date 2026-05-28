#!/usr/bin/env node
import { MexcClient } from "./api/mexc/client.js";
import { loadConfig } from "./config/index.js";
import { buildGridLevels, estimateGridProfitPerCycle } from "./strategies/grid/grid-config.js";
import { createLogger } from "./services/logger.js";
import { GridEngine } from "./strategies/grid/grid-engine.js";

const HELP = `
MEXC Spot Grid Trading Bot — CLI

Usage:
  npm run cli -- <command> [options]

Commands:
  start [--dry-run]     Start the grid bot (add --dry-run to simulate orders)
  simulate              Print grid levels and strategy preview
  status                Show current ticker and connection status
  ping                  Test MEXC API connectivity
  help                  Show this message

Examples:
  npm run cli -- simulate
  npm run cli -- start --dry-run
  npm run dev
`;

async function cmdSimulate(): Promise<void> {
  process.env.MEXC_API_KEY = process.env.MEXC_API_KEY || "preview";
  process.env.MEXC_SECRET_KEY = process.env.MEXC_SECRET_KEY || "preview";

  const config = loadConfig({ dryRun: true });
  const levels = buildGridLevels({
    mode: config.trading.gridMode,
    lowerPrice: config.trading.lowerPrice,
    upperPrice: config.trading.upperPrice,
    levels: config.trading.levels,
    orderSize: config.trading.orderSize,
  });

  console.log("\n=== MEXC Grid Strategy Preview ===\n");
  console.log(`Symbol:      ${config.trading.symbol}`);
  console.log(`Mode:        ${config.trading.gridMode}`);
  console.log(`Range:       ${config.trading.lowerPrice} — ${config.trading.upperPrice}`);
  console.log(`Levels:      ${config.trading.levels}`);
  console.log(`Order size:  ${config.trading.orderSize}`);
  console.log("\nGrid levels:\n");

  const client = new MexcClient({
    apiKey: "public",
    secretKey: "public",
    baseUrl: config.mexc.baseUrl,
  });

  let lastPrice = (config.trading.lowerPrice + config.trading.upperPrice) / 2;

  try {
    const ticker = await client.getPriceTicker(config.trading.symbol);
    lastPrice = Number(ticker.price);
    console.log(`Current price: ${lastPrice}\n`);

    if (lastPrice > config.trading.upperPrice) {
      console.log(
        "⚠️  Price is ABOVE your grid range — only BUY orders will be placed until price enters the range.\n",
      );
    } else if (lastPrice < config.trading.lowerPrice) {
      console.log(
        "⚠️  Price is BELOW your grid range — only SELL orders will be placed until price enters the range.\n",
      );
    }
  } catch {
    console.log(`(Could not fetch live price; using midpoint ${lastPrice})\n`);
  }

  for (const level of levels) {
    const action =
      level.price < lastPrice
        ? "BUY "
        : level.price > lastPrice
          ? "SELL"
          : "----";
    const profit = estimateGridProfitPerCycle(
      levels,
      level.index,
      config.trading.orderSize,
    );
    const profitHint = profit > 0 ? `  (~${profit.toFixed(4)} quote/cycle)` : "";
    console.log(
      `  [${String(level.index).padStart(2)}] ${level.price.toFixed(2).padStart(12)}  →  ${action}${profitHint}`,
    );
  }

  console.log("\n✓ Simulation complete. Use 'start --dry-run' to test order flow.\n");
}

async function cmdStatus(): Promise<void> {
  const config = loadConfig({ dryRun: true });
  const client = new MexcClient({
    apiKey: config.mexc.apiKey,
    secretKey: config.mexc.secretKey,
    baseUrl: config.mexc.baseUrl,
  });

  const [ticker, serverTime] = await Promise.all([
    client.getTicker24hr(config.trading.symbol),
    client.getServerTime(),
  ]);

  console.log("\n=== MEXC Market Status ===\n");
  console.log(`Symbol:       ${ticker.symbol}`);
  console.log(`Last price:   ${ticker.lastPrice ?? ticker.price}`);
  console.log(`24h high:     ${ticker.highPrice}`);
  console.log(`24h low:      ${ticker.lowPrice}`);
  console.log(`Server time:  ${new Date(serverTime.serverTime).toISOString()}`);
}

async function cmdPing(): Promise<void> {
  const config = loadConfig({ dryRun: true });
  const client = new MexcClient({
    apiKey: "public",
    secretKey: "public",
    baseUrl: config.mexc.baseUrl,
  });

  await client.ping();
  const time = await client.getServerTime();
  console.log(`\n✓ MEXC API reachable. Server time: ${new Date(time.serverTime).toISOString()}\n`);
}

async function cmdStart(dryRun: boolean): Promise<void> {
  const config = loadConfig({ dryRun });
  const logger = createLogger(config.logLevel);

  const client = new MexcClient({
    apiKey: config.mexc.apiKey,
    secretKey: config.mexc.secretKey,
    baseUrl: config.mexc.baseUrl,
  });

  const engine = new GridEngine(client, config, logger);

  const shutdown = async () => {
    await engine.shutdown(!dryRun);
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());

  await engine.initialize();
  await engine.deployInitialGrid();
  engine.startPolling();

  logger.info({ dryRun }, "Grid bot started");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] ?? "help";
  const dryRun = args.includes("--dry-run");

  switch (command) {
    case "simulate":
      await cmdSimulate();
      break;
    case "status":
      await cmdStatus();
      break;
    case "ping":
      await cmdPing();
      break;
    case "start":
      await cmdStart(dryRun);
      break;
    case "help":
    default:
      console.log(HELP);
      break;
  }
}

main().catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
