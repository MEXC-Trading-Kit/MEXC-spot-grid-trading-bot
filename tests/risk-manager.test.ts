import { describe, expect, it } from "vitest";
import { buildGridLevels } from "../src/strategies/grid/grid-config.js";
import { RiskManager } from "../src/services/risk-manager.js";

describe("RiskManager", () => {
  const levels = buildGridLevels({
    mode: "arithmetic",
    lowerPrice: 100,
    upperPrice: 200,
    levels: 5,
    orderSize: 1,
  });

  it("validates grid config", () => {
    const rm = new RiskManager({ orderSize: 1 });
    expect(rm.validateGridConfig(levels).allowed).toBe(true);
  });

  it("blocks buys over max exposure", () => {
    const rm = new RiskManager({ orderSize: 1, maxQuoteExposure: 50 });
    rm.recordBuy(100, 0.4);
    const result = rm.canPlaceBuyOrder(150, 0.2);
    expect(result.allowed).toBe(false);
  });

  it("triggers stop loss", () => {
    const rm = new RiskManager({ orderSize: 1, stopLossPrice: 90 });
    expect(rm.checkPriceTriggers(89)).toBe("stop_loss");
    expect(rm.checkPriceTriggers(100)).toBeNull();
  });

  it("triggers take profit", () => {
    const rm = new RiskManager({ orderSize: 1, takeProfitPrice: 210 });
    expect(rm.checkPriceTriggers(211)).toBe("take_profit");
  });
});
