import { describe, expect, it } from "vitest";
import {
  add,
  divide,
  formatPrice,
  formatQuantity,
  multiply,
  round,
} from "../src/utils/decimal.js";

describe("decimal helpers", () => {
  it("rounds with precision", () => {
    expect(round(1.23456789, 4)).toBe(1.2346);
  });

  it("adds and multiplies without drift", () => {
    expect(add(0.1, 0.2)).toBe(0.3);
    expect(multiply(0.1, 3)).toBe(0.3);
  });

  it("divides safely", () => {
    expect(divide(10, 4)).toBe(2.5);
    expect(() => divide(1, 0)).toThrow("Division by zero");
  });

  it("formats price to tick size", () => {
    expect(formatPrice(65000.567, "0.01")).toBe("65000.57");
    expect(formatPrice(65000.567, "0.1")).toBe("65000.6");
  });

  it("formats quantity to step size", () => {
    expect(formatQuantity(0.001234, "0.00001")).toBe("0.00123");
  });
});
