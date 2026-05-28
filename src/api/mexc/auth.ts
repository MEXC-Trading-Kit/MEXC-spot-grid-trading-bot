import { createHmac } from "node:crypto";

export interface SignedParams {
  [key: string]: string;
}

/**
 * MEXC Spot v3 HMAC SHA256 signature (lowercase hex).
 * totalParams = queryString concatenated with request body (no separator).
 */
export function signRequest(secretKey: string, totalParams: string): string {
  return createHmac("sha256", secretKey).update(totalParams).digest("hex");
}

export function toQueryString(params: Record<string, string | number>): string {
  return Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
}

export function buildSignedParams(
  secretKey: string,
  params: Record<string, string | number | undefined>,
  timestamp: number,
  recvWindow: number,
): SignedParams {
  const payload: Record<string, string | number> = {
    recvWindow,
    timestamp,
  };

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      payload[key] = value;
    }
  }

  const queryString = toQueryString(payload);
  const signature = signRequest(secretKey, queryString);

  const signed: SignedParams = {};
  for (const [key, value] of Object.entries(payload)) {
    signed[key] = String(value);
  }
  signed.signature = signature;

  return signed;
}

export function encodeFormBody(params: SignedParams): string {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}
