import type { NaverAdsCredentials } from "../config/credentials.js";
import { buildHeaders } from "./signer.js";
import type { BuildHeadersParams } from "./signer.js";

export interface ClientConfig {
  /** e.g. "https://api.searchad.naver.com" */
  baseUrl: string;
  credentials: NaverAdsCredentials;
  /** Injectable for tests */
  fetch?: typeof globalThis.fetch;
  /** Injectable for tests; defaults to buildHeaders from signer.ts */
  signer?: typeof buildHeaders;
  /**
   * Retry config.
   * max    = number of *retries* after the initial attempt (total fetches = max + 1)
   * delays = baseDelayMs * 2^retryIndex  (0-indexed: 100, 200, 400 for max=3, base=100)
   */
  retry?: { max: number; baseDelayMs: number };
}

export class NaverAdsApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: string,
  ) {
    super(message);
    this.name = "NaverAdsApiError";
  }
}

const DEFAULT_RETRY = { max: 3, baseDelayMs: 100 };

/** Resolves after `ms` milliseconds, using the global setTimeout so vi.useFakeTimers() works. */
function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export class NaverAdsClient {
  private readonly _fetch: typeof globalThis.fetch;
  private readonly _signer: typeof buildHeaders;
  private readonly _retry: { max: number; baseDelayMs: number };

  constructor(private readonly config: ClientConfig) {
    this._fetch = config.fetch ?? globalThis.fetch;
    this._signer = config.signer ?? buildHeaders;
    this._retry = config.retry ?? DEFAULT_RETRY;
  }

  async get<T>(
    path: string,
    query?: Record<string, string | number | undefined>,
  ): Promise<T> {
    return this._request<T>("GET", path, undefined, query);
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this._request<T>("POST", path, body);
  }

  // Signed GET for an absolute URL returning binary. Signs path-only per Naver
  // spec (query string excluded). No retry — caller has already proven the
  // resource exists via the BUILT poll, so a 5xx here is a hard failure.
  async downloadBinary(absoluteUrl: string): Promise<Buffer> {
    const { credentials } = this.config;
    const path = new URL(absoluteUrl).pathname;
    const authHeaders = this._signer({
      customerId: credentials.customerId,
      accessLicense: credentials.accessLicense,
      secretKey: credentials.secretKey,
      method: "GET",
      uri: path,
    } satisfies BuildHeadersParams);

    let response: Response;
    try {
      response = await this._fetch(absoluteUrl, {
        method: "GET",
        headers: { ...authHeaders },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new NaverAdsApiError(`Network error: ${msg}`, 0, undefined);
    }
    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      throw new NaverAdsApiError(
        `Download failed (${response.status})`,
        response.status,
        bodyText,
      );
    }
    return Buffer.from(await response.arrayBuffer());
  }

  // ---------------------------------------------------------------------------
  // Core request engine: handles signing, retry, backoff
  // ---------------------------------------------------------------------------
  private async _request<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string | number | undefined>,
  ): Promise<T> {
    const { baseUrl, credentials } = this.config;

    // Build query string (filter out undefined values)
    let fullUrl = `${baseUrl}${path}`;
    if (query) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          params.set(key, String(value));
        }
      }
      const qs = params.toString();
      if (qs) fullUrl = `${fullUrl}?${qs}`;
    }

    // URI for signing is path only (no query string, as per Naver spec)
    const signingUri = path;

    const buildRequestInit = (): RequestInit => {
      const authHeaders = this._signer({
        customerId: credentials.customerId,
        accessLicense: credentials.accessLicense,
        secretKey: credentials.secretKey,
        method,
        uri: signingUri,
        // timestamp auto-generated inside buildHeaders if omitted
      } satisfies BuildHeadersParams);

      const headers: Record<string, string> = { ...authHeaders };
      if (body !== undefined) {
        headers["Content-Type"] = "application/json";
      }

      const init: RequestInit = { method, headers };
      if (body !== undefined) {
        init.body = JSON.stringify(body);
      }
      return init;
    };

    // -------------------------------------------------------------------------
    // 401-specific retry: try once more with a fresh sign, then give up.
    // This is a separate concern from 5xx exponential backoff.
    // -------------------------------------------------------------------------
    const executeWithAuth = async (attemptsLeft: number): Promise<Response> => {
      let response: Response;
      try {
        response = await this._fetch(fullUrl, buildRequestInit());
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new NaverAdsApiError(`Network error: ${msg}`, 0, undefined);
      }

      if (response.status === 401) {
        if (attemptsLeft <= 0) {
          const bodyText = await response.text().catch(() => "");
          throw new NaverAdsApiError(
            "Authentication failed (401)",
            401,
            bodyText,
          );
        }
        // Re-sign with a fresh timestamp and retry immediately (no delay)
        let retryResponse: Response;
        try {
          retryResponse = await this._fetch(fullUrl, buildRequestInit());
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          throw new NaverAdsApiError(`Network error: ${msg}`, 0, undefined);
        }
        if (retryResponse.status === 401) {
          const bodyText = await retryResponse.text().catch(() => "");
          throw new NaverAdsApiError(
            "Authentication failed (401)",
            401,
            bodyText,
          );
        }
        return retryResponse;
      }

      return response;
    };

    // -------------------------------------------------------------------------
    // Outer retry loop: handles 5xx and 429
    // max = number of retries; initial attempt = attempt 0
    // -------------------------------------------------------------------------
    let lastError: NaverAdsApiError | undefined;
    // When a 429 Retry-After wait already served as the delay, skip the
    // exponential-backoff sleep at the top of the next loop iteration.
    let skipNextDelay = false;

    for (let attempt = 0; attempt <= this._retry.max; attempt++) {
      // Backoff before retry attempts (not before the first attempt)
      if (attempt > 0 && !skipNextDelay) {
        const delayMs = this._retry.baseDelayMs * Math.pow(2, attempt - 1);
        await sleep(delayMs);
      }
      skipNextDelay = false;

      let response: Response;
      try {
        // 401 gets its own 1-retry budget, separate from the 5xx counter
        response = await executeWithAuth(1);
      } catch (err) {
        if (err instanceof NaverAdsApiError) {
          // 401 auth failure is terminal — do not retry via 5xx loop
          if (err.status === 401) throw err;
          // Network error — propagate immediately
          if (err.status === 0) throw err;
        }
        throw err;
      }

      // 2xx → success
      if (response.status >= 200 && response.status < 300) {
        return (await response.json()) as T;
      }

      // 429 Rate Limited → read Retry-After, wait, then retry (counts as one retry)
      if (response.status === 429) {
        const retryAfterHeader = response.headers.get("Retry-After");
        const retryAfterSec = retryAfterHeader ? Number(retryAfterHeader) : 1;
        lastError = new NaverAdsApiError(
          `Rate limited (429), Retry-After: ${retryAfterSec}s`,
          429,
          await response.text().catch(() => ""),
        );
        // The Retry-After wait serves as the delay for this retry slot;
        // suppress the exponential-backoff delay at the top of the next iteration.
        await sleep(retryAfterSec * 1000);
        skipNextDelay = true;
        continue;
      }

      // 5xx → record error and retry with exponential backoff (applied at loop top)
      if (response.status >= 500) {
        lastError = new NaverAdsApiError(
          `Server error (${response.status})`,
          response.status,
          await response.text().catch(() => ""),
        );
        continue;
      }

      // Other 4xx → fail immediately, no retry
      const bodyText = await response.text().catch(() => "");
      throw new NaverAdsApiError(
        `Client error (${response.status})`,
        response.status,
        bodyText,
      );
    }

    // All attempts exhausted
    throw (
      lastError ??
      new NaverAdsApiError("Request failed after max retries", 0, undefined)
    );
  }
}
