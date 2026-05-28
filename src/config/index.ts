import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const GridModeSchema = z.enum(["arithmetic", "geometric"]);

export const ConfigSchema = z.object({
  mexc: z.object({
    apiKey: z.string().min(1),
    secretKey: z.string().min(1),
    baseUrl: z.string().url(),
  }),
  trading: z.object({
    symbol: z.string().min(1),
    gridMode: GridModeSchema,
    lowerPrice: z.number().positive(),
    upperPrice: z.number().positive(),
    levels: z.number().int().min(2).max(200),
    orderSize: z.number().positive(),
    maxQuoteExposure: z.number().positive().optional(),
    stopLossPrice: z.number().positive().optional(),
    takeProfitPrice: z.number().positive().optional(),
    pollIntervalMs: z.number().int().min(1000).default(5000),
    dryRun: z.boolean().default(false),
  }),
  logLevel: z.string().default("info"),
});

export type AppConfig = z.infer<typeof ConfigSchema>;
export type GridMode = z.infer<typeof GridModeSchema>;

/** Normalize BTC-USDT, btc_usdt → BTCUSDT */
export function normalizeSymbol(raw: string): string {
  return raw.replace(/[-_/ ]/g, "").toUpperCase();
}

export function loadConfig(overrides?: Partial<{ dryRun: boolean }>): AppConfig {
  const lowerPrice = Number(process.env.GRID_LOWER_PRICE);
  const upperPrice = Number(process.env.GRID_UPPER_PRICE);

  const raw = {
    mexc: {
      apiKey: process.env.MEXC_API_KEY ?? "",
      secretKey: process.env.MEXC_SECRET_KEY ?? "",
      baseUrl: process.env.MEXC_BASE_URL ?? "https://api.mexc.com",
    },
    trading: {
      symbol: normalizeSymbol(process.env.MEXC_SYMBOL ?? "BTCUSDT"),
      gridMode: (process.env.GRID_MODE ?? "arithmetic") as GridMode,
      lowerPrice,
      upperPrice,
      levels: Number(process.env.GRID_LEVELS ?? 10),
      orderSize: Number(process.env.GRID_ORDER_SIZE ?? 0.001),
      maxQuoteExposure: process.env.MAX_QUOTE_EXPOSURE
        ? Number(process.env.MAX_QUOTE_EXPOSURE)
        : undefined,
      stopLossPrice: process.env.STOP_LOSS_PRICE
        ? Number(process.env.STOP_LOSS_PRICE)
        : undefined,
      takeProfitPrice: process.env.TAKE_PROFIT_PRICE
        ? Number(process.env.TAKE_PROFIT_PRICE)
        : undefined,
      pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 5000),
      dryRun: overrides?.dryRun ?? process.env.DRY_RUN === "true",
    },
    logLevel: process.env.LOG_LEVEL ?? "info",
  };

  const parsed = ConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid configuration:\n${issues}`);
  }

  if (parsed.data.trading.lowerPrice >= parsed.data.trading.upperPrice) {
    throw new Error("GRID_LOWER_PRICE must be less than GRID_UPPER_PRICE");
  }

  return parsed.data;
}
