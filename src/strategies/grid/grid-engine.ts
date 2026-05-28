import type { MexcClient } from "../../api/mexc/client.js";
import type { AppConfig } from "../../config/index.js";
import type { Logger } from "../../services/logger.js";
import { RiskManager } from "../../services/risk-manager.js";
import {
  buildGridLevels,
  findNearestLevelIndex,
  getLevelAbove,
  getLevelBelow,
  type GridLevel,
} from "./grid-config.js";
import { OrderManager } from "./order-manager.js";

export interface GridEngineStats {
  totalBuys: number;
  totalSells: number;
  profitCycles: number;
  activeOrders: number;
  lastPrice: number;
}

export class GridEngine {
  private readonly levels: GridLevel[];
  private readonly orderManager: OrderManager;
  private readonly riskManager: RiskManager;
  private running = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private tickSize: string | undefined;
  private stepSize: string | undefined;
  private stats: GridEngineStats = {
    totalBuys: 0,
    totalSells: 0,
    profitCycles: 0,
    activeOrders: 0,
    lastPrice: 0,
  };

  constructor(
    private readonly client: MexcClient,
    private readonly config: AppConfig,
    private readonly logger: Logger,
  ) {
    const { trading } = config;

    this.levels = buildGridLevels({
      mode: trading.gridMode,
      lowerPrice: trading.lowerPrice,
      upperPrice: trading.upperPrice,
      levels: trading.levels,
      orderSize: trading.orderSize,
    });

    this.orderManager = new OrderManager(
      client,
      { symbol: trading.symbol, dryRun: trading.dryRun },
      logger,
    );

    this.riskManager = new RiskManager({
      maxQuoteExposure: trading.maxQuoteExposure,
      orderSize: trading.orderSize,
      stopLossPrice: trading.stopLossPrice,
      takeProfitPrice: trading.takeProfitPrice,
    });
  }

  getLevels(): GridLevel[] {
    return [...this.levels];
  }

  getStats(): GridEngineStats {
    return {
      ...this.stats,
      activeOrders: this.orderManager.getActiveOrders().length,
    };
  }

  async initialize(): Promise<void> {
    const riskCheck = this.riskManager.validateGridConfig(this.levels);
    if (!riskCheck.allowed) {
      throw new Error(riskCheck.reason);
    }

    try {
      const symbolInfo = await this.client.getSymbolInfo(
        this.config.trading.symbol,
      );
      const precision = this.client.extractPrecision(symbolInfo);
      this.tickSize = precision.tickSize;
      this.stepSize = precision.stepSize;
      this.logger.info(
        {
          symbol: symbolInfo.symbol,
          tickSize: precision.tickSize,
          stepSize: precision.stepSize,
          minQty: precision.minQty,
        },
        "Symbol precision loaded",
      );
    } catch (err) {
      this.logger.warn({ err }, "Could not load symbol info; using default precision");
    }

    const ticker = await this.client.getPriceTicker(this.config.trading.symbol);
    const lastPrice = Number(ticker.price);
    this.stats.lastPrice = lastPrice;

    this.logger.info(
      {
        levels: this.levels.length,
        range: [this.levels[0]!.price, this.levels.at(-1)!.price],
        lastPrice,
        mode: this.config.trading.gridMode,
        dryRun: this.config.trading.dryRun,
        symbol: this.config.trading.symbol,
      },
      "Grid engine initialized",
    );
  }

  /**
   * Places initial grid: buy orders below current price, sell orders above.
   */
  async deployInitialGrid(): Promise<void> {
    const ticker = await this.client.getPriceTicker(this.config.trading.symbol);
    const lastPrice = Number(ticker.price);
    this.stats.lastPrice = lastPrice;

    const centerIndex = findNearestLevelIndex(this.levels, lastPrice);
    const { orderSize } = this.config.trading;

    for (let i = 0; i < this.levels.length; i++) {
      const level = this.levels[i]!;

      if (level.price < lastPrice) {
        await this.placeBuyIfAllowed(i, level.price, orderSize);
      } else if (level.price > lastPrice) {
        await this.placeSellIfAllowed(i, level.price, orderSize);
      }
    }

    this.logger.info(
      { centerIndex, lastPrice, activeOrders: this.orderManager.getActiveOrders().length },
      "Initial grid deployed",
    );
  }

  private async placeBuyIfAllowed(
    levelIndex: number,
    price: number,
    size: number,
  ): Promise<void> {
    if (this.orderManager.findOrderByLevel(levelIndex, "buy")) return;

    const risk = this.riskManager.canPlaceBuyOrder(price, size);
    if (!risk.allowed) {
      this.logger.warn({ levelIndex, reason: risk.reason }, "Buy blocked by risk");
      return;
    }

    await this.orderManager.placeLimitOrder(
      levelIndex,
      "buy",
      price,
      size,
      this.tickSize,
      this.stepSize,
    );
    this.riskManager.recordBuy(price, size);
    this.stats.totalBuys += 1;
  }

  private async placeSellIfAllowed(
    levelIndex: number,
    price: number,
    size: number,
  ): Promise<void> {
    if (this.orderManager.findOrderByLevel(levelIndex, "sell")) return;

    await this.orderManager.placeLimitOrder(
      levelIndex,
      "sell",
      price,
      size,
      this.tickSize,
      this.stepSize,
    );
    this.stats.totalSells += 1;
  }

  /**
   * Core grid logic: when a buy fills at level N, place sell at N+1;
   * when a sell fills at level N, place buy at N-1.
   */
  async onOrderFilled(levelIndex: number, side: "buy" | "sell"): Promise<void> {
    const { orderSize } = this.config.trading;

    if (side === "buy") {
      const above = getLevelAbove(this.levels, levelIndex);
      if (above) {
        await this.placeSellIfAllowed(above.index, above.price, orderSize);
        this.stats.profitCycles += 1;
      }
    } else {
      const below = getLevelBelow(this.levels, levelIndex);
      if (below) {
        await this.placeBuyIfAllowed(below.index, below.price, orderSize);
        this.riskManager.recordSell(
          this.levels[levelIndex]!.price,
          orderSize,
        );
      }
    }
  }

  async pollAndRebalance(): Promise<void> {
    const ticker = await this.client.getPriceTicker(this.config.trading.symbol);
    const lastPrice = Number(ticker.price);
    this.stats.lastPrice = lastPrice;

    const trigger = this.riskManager.checkPriceTriggers(lastPrice);
    if (trigger) {
      this.logger.warn({ trigger, lastPrice }, "Price trigger hit — shutting down grid");
      await this.shutdown(true);
      return;
    }

    const previousOrders = this.orderManager.getActiveOrders();
    await this.orderManager.syncWithExchange();
    const currentOrders = this.orderManager.getActiveOrders();

    const filled = previousOrders.filter(
      (prev) => !currentOrders.some((c) => c.clientOrderId === prev.clientOrderId),
    );

    for (const order of filled) {
      if (order.state === "live" || order.state === "filled") {
        this.logger.info(
          { levelIndex: order.levelIndex, side: order.side, price: order.price },
          "Order filled — rebalancing grid",
        );
        await this.onOrderFilled(order.levelIndex, order.side);
      }
    }

    this.stats.activeOrders = this.orderManager.getActiveOrders().length;
  }

  startPolling(): void {
    if (this.running) return;
    this.running = true;

    const interval = this.config.trading.pollIntervalMs;
    this.pollTimer = setInterval(() => {
      void this.pollAndRebalance().catch((err) => {
        this.logger.error({ err }, "Poll cycle failed");
      });
    }, interval);

    this.logger.info({ intervalMs: interval }, "Grid polling started");
  }

  stop(): void {
    this.running = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.logger.info("Grid engine stopped");
  }

  async shutdown(cancelOrders = true): Promise<void> {
    this.stop();

    if (cancelOrders && !this.config.trading.dryRun) {
      try {
        await this.client.cancelAllOrders(this.config.trading.symbol);
        this.logger.info("All open orders canceled");
      } catch (err) {
        this.logger.error({ err }, "Failed to cancel orders on shutdown");
      }
    }
  }
}
