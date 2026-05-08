import { describe, it, expect } from "vitest";
import { sign, buildHeaders } from "../src/api/signer.js";

// Golden values pre-computed with:
// node -e "console.log(require('crypto').createHmac('sha256','test-secret').update('1717843200000.GET./stat-reports').digest('base64'))"
const GOLDEN_TIMESTAMP = 1717843200000;
const GOLDEN_SECRET = "test-secret";
const GOLDEN_EXPECTED = "jyl9K+9iJWBcCAT1+eIaOU40FQmSfKyz65c/NNzomrk=";

describe("US-003 sign()", () => {
  it("golden test — deterministic base64 for fixed inputs", () => {
    const result = sign({
      timestamp: GOLDEN_TIMESTAMP,
      method: "GET",
      uri: "/stat-reports",
      secretKey: GOLDEN_SECRET,
    });
    expect(result).toBe(GOLDEN_EXPECTED);
  });

  it("GET request signing produces base64 output", () => {
    const result = sign({
      timestamp: 1717843200000,
      method: "GET",
      uri: "/ncc/campaigns",
      secretKey: "any-secret",
    });
    // base64 regex: only valid base64 chars
    expect(result).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it("POST request signing produces different signature than GET", () => {
    const common = { timestamp: 1717843200000, uri: "/ncc/campaigns", secretKey: "any-secret" };
    const getResult = sign({ ...common, method: "GET" });
    const postResult = sign({ ...common, method: "POST" });
    expect(postResult).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(postResult).not.toBe(getResult);
  });

  it("strips query string: /stat-reports?id=1 matches /stat-reports", () => {
    const withQuery = sign({
      timestamp: GOLDEN_TIMESTAMP,
      method: "GET",
      uri: "/stat-reports?id=1",
      secretKey: GOLDEN_SECRET,
    });
    const withoutQuery = sign({
      timestamp: GOLDEN_TIMESTAMP,
      method: "GET",
      uri: "/stat-reports",
      secretKey: GOLDEN_SECRET,
    });
    expect(withQuery).toBe(withoutQuery);
    expect(withQuery).toBe(GOLDEN_EXPECTED);
  });

  it("method is case-insensitive: 'get' produces same result as 'GET'", () => {
    const lower = sign({ timestamp: GOLDEN_TIMESTAMP, method: "get", uri: "/stat-reports", secretKey: GOLDEN_SECRET });
    const upper = sign({ timestamp: GOLDEN_TIMESTAMP, method: "GET", uri: "/stat-reports", secretKey: GOLDEN_SECRET });
    expect(lower).toBe(upper);
    expect(lower).toBe(GOLDEN_EXPECTED);
  });

  it("accepts numeric timestamp (Date.now() style)", () => {
    const result = sign({ timestamp: Date.now(), method: "GET", uri: "/ncc/campaigns", secretKey: "any-secret" });
    expect(result).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it("accepts string timestamp", () => {
    const asNumber = sign({ timestamp: 1717843200000, method: "GET", uri: "/stat-reports", secretKey: GOLDEN_SECRET });
    const asString = sign({ timestamp: "1717843200000", method: "GET", uri: "/stat-reports", secretKey: GOLDEN_SECRET });
    expect(asString).toBe(asNumber);
  });
});

describe("US-003 buildHeaders()", () => {
  const baseParams = {
    customerId: "cust-123",
    accessLicense: "lic-abc",
    secretKey: GOLDEN_SECRET,
    method: "GET",
    uri: "/stat-reports",
    timestamp: GOLDEN_TIMESTAMP,
  };

  it("returns exactly the 4 X-* headers", () => {
    const headers = buildHeaders(baseParams);
    const keys = Object.keys(headers);
    expect(keys).toHaveLength(4);
    expect(keys).toContain("X-Timestamp");
    expect(keys).toContain("X-API-KEY");
    expect(keys).toContain("X-Customer");
    expect(keys).toContain("X-Signature");
  });

  it("X-Signature matches sign() output", () => {
    const headers = buildHeaders(baseParams);
    const expected = sign({
      timestamp: GOLDEN_TIMESTAMP,
      method: "GET",
      uri: "/stat-reports",
      secretKey: GOLDEN_SECRET,
    });
    expect(headers["X-Signature"]).toBe(expected);
    expect(headers["X-Signature"]).toBe(GOLDEN_EXPECTED);
  });

  it("SECRET_KEY does NOT appear in returned headers", () => {
    const headers = buildHeaders(baseParams);
    const values = Object.values(headers);
    // Secret key must never leak into any header value
    expect(values).not.toContain(GOLDEN_SECRET);
    expect(values.some((v) => v.includes(GOLDEN_SECRET))).toBe(false);
  });

  it("X-Timestamp is string representation of the timestamp", () => {
    const headers = buildHeaders(baseParams);
    expect(headers["X-Timestamp"]).toBe(String(GOLDEN_TIMESTAMP));
  });

  it("X-API-KEY and X-Customer reflect the input params", () => {
    const headers = buildHeaders(baseParams);
    expect(headers["X-API-KEY"]).toBe("lic-abc");
    expect(headers["X-Customer"]).toBe("cust-123");
  });

  it("auto-generates timestamp when omitted", () => {
    const before = Date.now();
    const { timestamp: _omit, ...withoutTs } = baseParams;
    const headers = buildHeaders(withoutTs);
    const after = Date.now();
    const ts = Number(headers["X-Timestamp"]);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});
