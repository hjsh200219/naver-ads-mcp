import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NaverAdsClient, NaverAdsApiError, type ClientConfig } from "../src/api/client.js";
import type { BuildHeadersParams, SignedHeaders } from "../src/api/signer.js";

// ---------------------------------------------------------------------------
// Test credentials
// ---------------------------------------------------------------------------

const TEST_CREDENTIALS = {
  customerId: "cust-123",
  accessLicense: "lic-abc",
  secretKey: "sec-xyz",
};

const BASE_URL = "https://api.searchad.naver.com";

// ---------------------------------------------------------------------------
// Mock signer — deterministic, call-countable
// ---------------------------------------------------------------------------

let signerCallCount = 0;

function makeMockSigner(
  tsOverride?: () => number
): (params: BuildHeadersParams) => SignedHeaders {
  return (params: BuildHeadersParams): SignedHeaders => {
    signerCallCount++;
    const timestamp = tsOverride ? tsOverride() : params.timestamp ?? 1000;
    return {
      "X-Timestamp": String(timestamp),
      "X-API-KEY": params.accessLicense,
      "X-Customer": params.customerId,
      "X-Signature": `mock-sig-${signerCallCount}`,
    };
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a Response with optional headers */
function makeResponse(
  status: number,
  body: unknown = {},
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/** Captured fetch call */
interface CapturedCall {
  url: string;
  init: RequestInit;
}

function captureFetch(responses: Response[]): {
  fetchMock: typeof fetch;
  calls: CapturedCall[];
} {
  const calls: CapturedCall[] = [];
  let idx = 0;
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const resp = responses[idx++];
    if (!resp) throw new Error("fetchMock: no more responses queued");
    return resp;
  }) as unknown as typeof fetch;
  return { fetchMock, calls };
}

/** Build a minimal ClientConfig */
function makeConfig(
  fetchMock: typeof fetch,
  overrides: Partial<ClientConfig> = {}
): ClientConfig {
  return {
    baseUrl: BASE_URL,
    credentials: TEST_CREDENTIALS,
    fetch: fetchMock,
    signer: makeMockSigner(),
    retry: { max: 3, baseDelayMs: 50 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("US-004 NaverAdsClient", () => {
  beforeEach(() => {
    signerCallCount = 0;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. GET builds correct URL and attaches auth headers
  // -------------------------------------------------------------------------
  describe("get<T>() — URL + headers", () => {
    it("builds URL as baseUrl + path and attaches 4 X-* auth headers", async () => {
      const { fetchMock, calls } = captureAndQueue([makeResponse(200, { ok: true })]);
      const client = new NaverAdsClient(makeConfig(fetchMock));

      await client.get<{ ok: boolean }>("/ncc/campaigns");

      expect(calls).toHaveLength(1);
      const { url, init } = calls[0]!;
      expect(url).toBe(`${BASE_URL}/ncc/campaigns`);
      expect(init.method).toBe("GET");

      const headers = init.headers as Record<string, string>;
      expect(headers["X-Timestamp"]).toBeDefined();
      expect(headers["X-API-KEY"]).toBeDefined();
      expect(headers["X-Customer"]).toBeDefined();
      expect(headers["X-Signature"]).toBeDefined();
    });

    it("appends query string to URL when query object is provided", async () => {
      const { fetchMock, calls } = captureAndQueue([makeResponse(200, {})]);
      const client = new NaverAdsClient(makeConfig(fetchMock));

      await client.get<unknown>("/ncc/campaigns", { status: "ELIGIBLE", page: 1 });

      const { url } = calls[0]!;
      expect(url).toContain("status=ELIGIBLE");
      expect(url).toContain("page=1");
    });
  });

  // -------------------------------------------------------------------------
  // 2. POST sends JSON body + Content-Type header
  // -------------------------------------------------------------------------
  describe("post<T>() — JSON body", () => {
    it("sends POST with JSON body and Content-Type: application/json", async () => {
      const { fetchMock, calls } = captureAndQueue([makeResponse(200, { id: "new-1" })]);
      const client = new NaverAdsClient(makeConfig(fetchMock));

      const result = await client.post<{ id: string }>("/ncc/campaigns", { name: "Test" });

      expect(result).toEqual({ id: "new-1" });
      const { init } = calls[0]!;
      expect(init.method).toBe("POST");
      expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
        "application/json"
      );
      expect(init.body).toBe(JSON.stringify({ name: "Test" }));
    });
  });

  // -------------------------------------------------------------------------
  // 3. 200 response → returns parsed JSON typed as T
  // -------------------------------------------------------------------------
  describe("2xx → returns parsed JSON", () => {
    it("returns parsed JSON body typed as T on 200 OK", async () => {
      const payload = { campaigns: [{ id: "c1" }] };
      const { fetchMock } = captureAndQueue([makeResponse(200, payload)]);
      const client = new NaverAdsClient(makeConfig(fetchMock));

      const result = await client.get<typeof payload>("/ncc/campaigns");

      expect(result).toEqual(payload);
    });
  });

  // -------------------------------------------------------------------------
  // 4. 401 → re-sign with fresh timestamp, retry once; second 401 → throw
  // -------------------------------------------------------------------------
  describe("401 → re-sign + retry once", () => {
    it("re-signs on 401 and retries exactly once", async () => {
      let tsCounter = 1000;
      const tsSigner = makeMockSigner(() => {
        tsCounter += 100;
        return tsCounter;
      });

      const { fetchMock, calls } = captureAndQueue([
        makeResponse(401),
        makeResponse(200, { ok: true }),
      ]);
      const client = new NaverAdsClient({
        baseUrl: BASE_URL,
        credentials: TEST_CREDENTIALS,
        fetch: fetchMock,
        signer: tsSigner,
        retry: { max: 3, baseDelayMs: 50 },
      });

      const promise = client.get<{ ok: boolean }>("/auth-path");
      // No timer advance needed — 401 retry is immediate (no delay)
      const result = await promise;

      expect(result).toEqual({ ok: true });
      expect(calls).toHaveLength(2);

      // The two calls should have used different timestamps (fresh re-sign)
      const ts1 = (calls[0]!.init.headers as Record<string, string>)["X-Timestamp"];
      const ts2 = (calls[1]!.init.headers as Record<string, string>)["X-Timestamp"];
      expect(ts1).not.toBe(ts2);
    });

    it("throws NaverAdsApiError on second consecutive 401", async () => {
      const { fetchMock } = captureAndQueue([
        makeResponse(401),
        makeResponse(401),
      ]);
      const client = new NaverAdsClient(makeConfig(fetchMock));

      await expect(client.get("/auth-fail")).rejects.toThrow(NaverAdsApiError);
    });

    it("thrown error for 401 has status 401", async () => {
      const { fetchMock } = captureAndQueue([makeResponse(401), makeResponse(401)]);
      const client = new NaverAdsClient(makeConfig(fetchMock));

      let caught: NaverAdsApiError | undefined;
      try {
        await client.get("/auth-fail");
      } catch (e) {
        caught = e as NaverAdsApiError;
      }
      expect(caught?.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // 5. 5xx → exponential backoff, up to max retries
  // -------------------------------------------------------------------------
  describe("5xx → exponential backoff retry", () => {
    it("retries on 503 up to max attempts with exponential delay", async () => {
      // retry: max=3 means 3 retry attempts after initial → 4 fetches total
      // delays: 50ms (1st retry), 100ms (2nd), 200ms (3rd)
      const { fetchMock, calls } = captureAndQueue([
        makeResponse(503),
        makeResponse(503),
        makeResponse(503),
        makeResponse(200, { data: "ok" }),
      ]);
      const client = new NaverAdsClient(
        makeConfig(fetchMock, { retry: { max: 3, baseDelayMs: 50 } })
      );

      const promise = client.get<{ data: string }>("/stat-reports");

      // Advance through all retry delays at once: 50 + 100 + 200 = 350ms total
      await vi.advanceTimersByTimeAsync(400);

      const result = await promise;
      expect(result).toEqual({ data: "ok" });
      expect(calls).toHaveLength(4);
    });

    it("throws NaverAdsApiError after exhausting all retries on 5xx", async () => {
      // max=2 → 2 retries after initial = 3 fetches total
      // delays: 50ms before attempt 1, 100ms before attempt 2
      const { fetchMock, calls } = captureAndQueue([
        makeResponse(500),
        makeResponse(500),
        makeResponse(500),
      ]);
      const client = new NaverAdsClient(
        makeConfig(fetchMock, { retry: { max: 2, baseDelayMs: 50 } })
      );

      // Attach .catch immediately so the rejection is always handled
      let caught: NaverAdsApiError | undefined;
      const promise = client.get("/always-fails").catch((e: unknown) => {
        caught = e as NaverAdsApiError;
      });

      // Advance through all retry delays: 50ms + 100ms = 150ms total
      await vi.advanceTimersByTimeAsync(200);
      await promise;

      expect(caught).toBeInstanceOf(NaverAdsApiError);
      expect(calls).toHaveLength(3);
    });
  });

  // -------------------------------------------------------------------------
  // 6. 429 + Retry-After → wait, then retry (counts toward max)
  // -------------------------------------------------------------------------
  describe("429 with Retry-After → delayed retry", () => {
    it("waits Retry-After seconds before retrying on 429", async () => {
      const { fetchMock, calls } = captureAndQueue([
        makeResponse(429, {}, { "Retry-After": "2" }),
        makeResponse(200, { rate: "ok" }),
      ]);
      const client = new NaverAdsClient(
        makeConfig(fetchMock, { retry: { max: 3, baseDelayMs: 50 } })
      );

      const promise = client.get<{ rate: string }>("/rate-limited");

      // Advance by Retry-After value (2 seconds = 2000ms)
      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;
      expect(result).toEqual({ rate: "ok" });
      expect(calls).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // 7. Network error → re-throws as wrapped error
  // -------------------------------------------------------------------------
  describe("network error → wrapped error", () => {
    it("re-throws fetch network errors as NaverAdsApiError", async () => {
      const fetchMock = vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }) as unknown as typeof fetch;
      const client = new NaverAdsClient(makeConfig(fetchMock));

      await expect(client.get("/network-fail")).rejects.toThrow(NaverAdsApiError);
    });

    it("wrapped error message contains original error info", async () => {
      const fetchMock = vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }) as unknown as typeof fetch;
      const client = new NaverAdsClient(makeConfig(fetchMock));

      let caught: NaverAdsApiError | undefined;
      try {
        await client.get("/network-fail");
      } catch (e) {
        caught = e as NaverAdsApiError;
      }
      expect(caught?.message).toContain("Failed to fetch");
    });
  });

  // -------------------------------------------------------------------------
  // 8. Non-retryable 4xx (e.g. 400, 403, 404) → throw immediately, no retry
  // -------------------------------------------------------------------------
  describe("non-retryable 4xx → throw immediately", () => {
    it("throws NaverAdsApiError on 400 without retrying", async () => {
      const { fetchMock, calls } = captureAndQueue([makeResponse(400, { error: "bad" })]);
      const client = new NaverAdsClient(makeConfig(fetchMock));

      await expect(client.get("/bad-request")).rejects.toThrow(NaverAdsApiError);
      expect(calls).toHaveLength(1);
    });

    it("throws NaverAdsApiError with correct status on 404", async () => {
      const { fetchMock } = captureAndQueue([makeResponse(404)]);
      const client = new NaverAdsClient(makeConfig(fetchMock));

      let caught: NaverAdsApiError | undefined;
      try {
        await client.get("/not-found");
      } catch (e) {
        caught = e as NaverAdsApiError;
      }
      expect(caught?.status).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // 9. Custom signer injection
  // -------------------------------------------------------------------------
  describe("custom signer injection", () => {
    it("uses injected signer to produce auth headers", async () => {
      const customSigner = vi.fn((_params: BuildHeadersParams): SignedHeaders => ({
        "X-Timestamp": "9999999",
        "X-API-KEY": "custom-key",
        "X-Customer": "custom-cust",
        "X-Signature": "custom-sig",
      }));

      const { fetchMock, calls } = captureAndQueue([makeResponse(200, {})]);
      const client = new NaverAdsClient({
        baseUrl: BASE_URL,
        credentials: TEST_CREDENTIALS,
        fetch: fetchMock,
        signer: customSigner,
        retry: { max: 3, baseDelayMs: 50 },
      });

      await client.get("/custom");

      expect(customSigner).toHaveBeenCalled();
      const headers = calls[0]!.init.headers as Record<string, string>;
      expect(headers["X-API-KEY"]).toBe("custom-key");
      expect(headers["X-Signature"]).toBe("custom-sig");
    });

    it("default signer (buildHeaders) is used when no signer is injected", async () => {
      const { fetchMock, calls } = captureAndQueue([makeResponse(200, {})]);
      const client = new NaverAdsClient({
        baseUrl: BASE_URL,
        credentials: TEST_CREDENTIALS,
        fetch: fetchMock,
        // no signer → uses buildHeaders from signer.ts
        retry: { max: 3, baseDelayMs: 50 },
      });

      await client.get("/default-signer");

      const headers = calls[0]!.init.headers as Record<string, string>;
      // buildHeaders produces real HMAC signature — just check shape
      expect(headers["X-Timestamp"]).toBeDefined();
      expect(headers["X-API-KEY"]).toBe(TEST_CREDENTIALS.accessLicense);
      expect(headers["X-Customer"]).toBe(TEST_CREDENTIALS.customerId);
      expect(headers["X-Signature"]).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });
  });
});

// ---------------------------------------------------------------------------
// Helper to create fetch mock + response queue in one call
// (defined after describe blocks to avoid hoisting issues)
// ---------------------------------------------------------------------------

function captureAndQueue(responses: Response[]): {
  fetchMock: typeof fetch;
  calls: CapturedCall[];
} {
  return captureAndQueueImpl(responses);
}

function captureAndQueueImpl(responses: Response[]): {
  fetchMock: typeof fetch;
  calls: CapturedCall[];
} {
  const calls: CapturedCall[] = [];
  let idx = 0;
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const resp = responses[idx++];
    if (!resp) throw new Error("fetchMock: no more responses queued");
    return resp;
  }) as unknown as typeof fetch;
  return { fetchMock, calls };
}
