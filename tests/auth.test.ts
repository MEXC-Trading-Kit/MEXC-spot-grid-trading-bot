import { describe, expect, it } from "vitest";
import { signRequest, toQueryString } from "../src/api/mexc/auth.js";

describe("MEXC auth", () => {
  it("matches openssl HMAC SHA256 for MEXC example payload", () => {
    const totalParams =
      "symbol=BTCUSDT&side=BUY&type=LIMIT&quantity=1&price=11&recvWindow=5000&timestamp=1644489390087";
    const secretKey = "45d0b3c26f2644f19bfb98b07741b2f5";

    const signature = signRequest(secretKey, totalParams);
    expect(signature).toBe(
      "fd3e4e8543c5188531eb7279d68ae7d26a573d0fc5ab0d18eb692451654d837a",
    );
  });

  it("builds sorted query strings", () => {
    const qs = toQueryString({
      symbol: "BTCUSDT",
      side: "BUY",
      timestamp: 1644489390087,
      recvWindow: 5000,
    });
    expect(qs).toBe("recvWindow=5000&side=BUY&symbol=BTCUSDT&timestamp=1644489390087");
  });

  it("produces lowercase hex signatures", () => {
    const signature = signRequest("secret", "timestamp=123");
    expect(signature).toMatch(/^[0-9a-f]{64}$/);
  });
});
