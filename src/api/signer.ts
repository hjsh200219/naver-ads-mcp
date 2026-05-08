import { createHmac } from "node:crypto";

export interface SignParams {
  timestamp: number | string;
  method: string;    // HTTP method (will be upper-cased internally)
  uri: string;       // path only; query string is stripped before signing
  secretKey: string;
}

export interface BuildHeadersParams {
  customerId: string;
  accessLicense: string;
  secretKey: string;
  method: string;
  uri: string;
  timestamp?: number;
}

export interface SignedHeaders {
  "X-Timestamp": string;
  "X-API-KEY": string;
  "X-Customer": string;
  "X-Signature": string;
}

/**
 * Computes HMAC-SHA256 signature for a Naver Search Ad API request.
 * Payload format: `${timestamp}.${METHOD}.${path}` (query string stripped, method uppercased)
 */
export function sign(params: SignParams): string {
  const { timestamp, secretKey } = params;
  // Strip query string — only path is signed per Naver spec
  const path = params.uri.split("?")[0];
  // Method must be uppercase per spec
  const method = params.method.toUpperCase();
  const payload = `${timestamp}.${method}.${path}`;

  return createHmac("sha256", secretKey).update(payload).digest("base64");
}

/**
 * Builds the 4 required X-* authentication headers for a Naver Search Ad API request.
 * SECRET_KEY is used only to compute X-Signature and is never included in the output.
 */
export function buildHeaders(params: BuildHeadersParams): SignedHeaders {
  const { customerId, accessLicense, secretKey, method, uri } = params;
  // Use provided timestamp or auto-generate current epoch ms
  const timestamp = params.timestamp ?? Date.now();

  const signature = sign({ timestamp, method, uri, secretKey });

  return {
    "X-Timestamp": String(timestamp),
    "X-API-KEY": accessLicense,
    "X-Customer": customerId,
    "X-Signature": signature,
  };
}
