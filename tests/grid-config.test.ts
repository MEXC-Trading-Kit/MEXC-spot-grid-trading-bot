import { describe, expect, it } from "vitest";
import {
  buildGridLevels,
  estimateGridProfitPerCycle,
  findNearestLevelIndex,
  getLevelAbove,
  getLevelBelow,
} from "../src/strategies/grid/grid-config.js";

describe("buildGridLevels", () => {
  it("builds arithmetic grid with correct endpoints", () => {
    const levels = buildGridLevels({
      mode: "arithmetic",
      lowerPrice: 100,
      upperPrice: 200,
      levels: 5,
      orderSize: 1,
    });

    expect(levels).toHaveLength(5);
    expect(levels[0]!.price).toBe(100);
    expect(levels[4]!.price).toBe(200);
    expect(levels[2]!.price).toBe(150);
  });

  it("builds geometric grid with increasing prices", () => {
    const levels = buildGridLevels({
      mode: "geometric",
      lowerPrice: 100,
      upperPrice: 200,
      levels: 5,
      orderSize: 1,
    });

    expect(levels[0]!.price).toBe(100);
    expect(levels[4]!.price).toBe(200);

    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]!.price).toBeGreaterThan(levels[i - 1]!.price);
    }
  });

  it("throws when levels < 2", () => {
    expect(() =>
      buildGridLevels({
        mode: "arithmetic",
        lowerPrice: 100,
        upperPrice: 200,
        levels: 1,
        orderSize: 1,
      }),
    ).toThrow();
  });
});

describe("grid level navigation", () => {
  const levels = buildGridLevels({
    mode: "arithmetic",
    lowerPrice: 100,
    upperPrice: 300,
    levels: 5,
    orderSize: 1,
  });

  it("finds nearest level to price", () => {
    expect(findNearestLevelIndex(levels, 200)).toBe(2);
    expect(findNearestLevelIndex(levels, 95)).toBe(0);
  });

  it("returns adjacent levels", () => {
    expect(getLevelAbove(levels, 2)?.price).toBe(250);
    expect(getLevelBelow(levels, 2)?.price).toBe(150);
    expect(getLevelAbove(levels, 4)).toBeNull();
    expect(getLevelBelow(levels, 0)).toBeNull();
  });

  it("estimates profit per cycle", () => {
    const profit = estimateGridProfitPerCycle(levels, 1, 2);
    expect(profit).toBe(100);
  });
});
