import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  EnvCredentialLoader,
  MissingCredentialError,
  type ICredentialLoader,
  type NaverAdsCredentials,
} from "../src/config/credentials.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Canonical env var names */
const ENV_KEYS = {
  customerId: "NAVER_ADS_CUSTOMER_ID",
  accessLicense: "NAVER_ADS_ACCESS_LICENSE",
  secretKey: "NAVER_ADS_SECRET_KEY",
} as const;

/** Set all three env vars to valid test values via vi.stubEnv */
function stubAllEnv(overrides: Partial<Record<string, string>> = {}): void {
  vi.stubEnv(ENV_KEYS.customerId, overrides[ENV_KEYS.customerId] ?? "cust-123");
  vi.stubEnv(ENV_KEYS.accessLicense, overrides[ENV_KEYS.accessLicense] ?? "lic-abc");
  vi.stubEnv(ENV_KEYS.secretKey, overrides[ENV_KEYS.secretKey] ?? "sec-xyz");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("US-002 EnvCredentialLoader", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  describe("load() — happy path", () => {
    it("returns an object with customerId, accessLicense, secretKey when all vars are set", () => {
      stubAllEnv();
      const loader = new EnvCredentialLoader();
      const cred = loader.load();

      expect(cred.customerId).toBe("cust-123");
      expect(cred.accessLicense).toBe("lic-abc");
      expect(cred.secretKey).toBe("sec-xyz");
    });

    it("trims leading/trailing whitespace from values", () => {
      vi.stubEnv(ENV_KEYS.customerId, "  cust-123  ");
      vi.stubEnv(ENV_KEYS.accessLicense, "\tlic-abc\t");
      vi.stubEnv(ENV_KEYS.secretKey, " sec-xyz ");
      const cred = new EnvCredentialLoader().load();

      expect(cred.customerId).toBe("cust-123");
      expect(cred.accessLicense).toBe("lic-abc");
      expect(cred.secretKey).toBe("sec-xyz");
    });
  });

  // -------------------------------------------------------------------------
  // Trailing whitespace in key names (real .env quirk: "NAVER_ADS_CUSTOMER_ID =value")
  // -------------------------------------------------------------------------

  describe("load() — tolerates trailing whitespace in env key names", () => {
    beforeEach(() => {
      // Remove canonical keys to avoid fast-path match
      vi.stubEnv(ENV_KEYS.customerId, undefined as unknown as string);
      vi.stubEnv(ENV_KEYS.accessLicense, undefined as unknown as string);
      vi.stubEnv(ENV_KEYS.secretKey, undefined as unknown as string);
    });

    it("resolves NAVER_ADS_CUSTOMER_ID with trailing space in key", () => {
      // Simulate the slow-path: inject a key with trailing space directly
      process.env["NAVER_ADS_CUSTOMER_ID "] = "cust-spaced";
      process.env[ENV_KEYS.accessLicense] = "lic-abc";
      process.env[ENV_KEYS.secretKey] = "sec-xyz";

      try {
        const cred = new EnvCredentialLoader().load();
        expect(cred.customerId).toBe("cust-spaced");
      } finally {
        delete process.env["NAVER_ADS_CUSTOMER_ID "];
        delete process.env[ENV_KEYS.accessLicense];
        delete process.env[ENV_KEYS.secretKey];
      }
    });

    it("resolves NAVER_ADS_ACCESS_LICENSE with trailing space in key", () => {
      process.env[ENV_KEYS.customerId] = "cust-123";
      process.env["NAVER_ADS_ACCESS_LICENSE "] = "lic-spaced";
      process.env[ENV_KEYS.secretKey] = "sec-xyz";

      try {
        const cred = new EnvCredentialLoader().load();
        expect(cred.accessLicense).toBe("lic-spaced");
      } finally {
        delete process.env[ENV_KEYS.customerId];
        delete process.env["NAVER_ADS_ACCESS_LICENSE "];
        delete process.env[ENV_KEYS.secretKey];
      }
    });

    it("resolves NAVER_ADS_SECRET_KEY with trailing space in key", () => {
      process.env[ENV_KEYS.customerId] = "cust-123";
      process.env[ENV_KEYS.accessLicense] = "lic-abc";
      process.env["NAVER_ADS_SECRET_KEY "] = "sec-spaced";

      try {
        const cred = new EnvCredentialLoader().load();
        expect(cred.secretKey).toBe("sec-spaced");
      } finally {
        delete process.env[ENV_KEYS.customerId];
        delete process.env[ENV_KEYS.accessLicense];
        delete process.env["NAVER_ADS_SECRET_KEY "];
      }
    });
  });

  // -------------------------------------------------------------------------
  // Missing keys — must throw MissingCredentialError with identifying message
  // -------------------------------------------------------------------------

  describe("load() — throws on missing env vars", () => {
    it("throws MissingCredentialError when NAVER_ADS_CUSTOMER_ID is absent", () => {
      vi.stubEnv(ENV_KEYS.customerId, undefined as unknown as string);
      vi.stubEnv(ENV_KEYS.accessLicense, "lic-abc");
      vi.stubEnv(ENV_KEYS.secretKey, "sec-xyz");

      expect(() => new EnvCredentialLoader().load()).toThrowError(
        new MissingCredentialError(ENV_KEYS.customerId)
      );
    });

    it("error message identifies the missing key by name", () => {
      vi.stubEnv(ENV_KEYS.customerId, undefined as unknown as string);
      vi.stubEnv(ENV_KEYS.accessLicense, "lic-abc");
      vi.stubEnv(ENV_KEYS.secretKey, "sec-xyz");

      expect(() => new EnvCredentialLoader().load()).toThrowError(
        /NAVER_ADS_CUSTOMER_ID/
      );
    });

    it("throws MissingCredentialError when NAVER_ADS_ACCESS_LICENSE is absent", () => {
      vi.stubEnv(ENV_KEYS.customerId, "cust-123");
      vi.stubEnv(ENV_KEYS.accessLicense, undefined as unknown as string);
      vi.stubEnv(ENV_KEYS.secretKey, "sec-xyz");

      expect(() => new EnvCredentialLoader().load()).toThrowError(
        /NAVER_ADS_ACCESS_LICENSE/
      );
    });

    it("throws MissingCredentialError when NAVER_ADS_SECRET_KEY is absent", () => {
      vi.stubEnv(ENV_KEYS.customerId, "cust-123");
      vi.stubEnv(ENV_KEYS.accessLicense, "lic-abc");
      vi.stubEnv(ENV_KEYS.secretKey, undefined as unknown as string);

      expect(() => new EnvCredentialLoader().load()).toThrowError(
        /NAVER_ADS_SECRET_KEY/
      );
    });

    it("error message NEVER contains actual env values", () => {
      vi.stubEnv(ENV_KEYS.customerId, "super-secret-id");
      vi.stubEnv(ENV_KEYS.accessLicense, undefined as unknown as string);
      vi.stubEnv(ENV_KEYS.secretKey, "sec-xyz");

      let message = "";
      try {
        new EnvCredentialLoader().load();
      } catch (e) {
        message = (e as Error).message;
      }

      expect(message).not.toContain("super-secret-id");
      expect(message).not.toContain("sec-xyz");
    });

    it("thrown error is an instance of MissingCredentialError", () => {
      vi.stubEnv(ENV_KEYS.customerId, undefined as unknown as string);
      vi.stubEnv(ENV_KEYS.accessLicense, "lic-abc");
      vi.stubEnv(ENV_KEYS.secretKey, "sec-xyz");

      expect(() => new EnvCredentialLoader().load()).toThrow(MissingCredentialError);
    });

    it("thrown error is also an instance of Error", () => {
      vi.stubEnv(ENV_KEYS.customerId, undefined as unknown as string);
      vi.stubEnv(ENV_KEYS.accessLicense, "lic-abc");
      vi.stubEnv(ENV_KEYS.secretKey, "sec-xyz");

      expect(() => new EnvCredentialLoader().load()).toThrow(Error);
    });
  });

  // -------------------------------------------------------------------------
  // Non-enumerable secret fields — no leakage via JSON.stringify / console.log
  // -------------------------------------------------------------------------

  describe("load() — secret fields are non-enumerable", () => {
    it("JSON.stringify() does not include accessLicense value", () => {
      stubAllEnv();
      const cred = new EnvCredentialLoader().load();
      const json = JSON.stringify(cred);

      expect(json).not.toContain("lic-abc");
    });

    it("JSON.stringify() does not include secretKey value", () => {
      stubAllEnv();
      const cred = new EnvCredentialLoader().load();
      const json = JSON.stringify(cred);

      expect(json).not.toContain("sec-xyz");
    });

    it("JSON.stringify() DOES include customerId (safe to log)", () => {
      stubAllEnv();
      const cred = new EnvCredentialLoader().load();
      const json = JSON.stringify(cred);

      expect(json).toContain("cust-123");
    });

    it("accessLicense property is non-enumerable", () => {
      stubAllEnv();
      const cred = new EnvCredentialLoader().load();
      const descriptor = Object.getOwnPropertyDescriptor(cred, "accessLicense");

      expect(descriptor?.enumerable).toBe(false);
    });

    it("secretKey property is non-enumerable", () => {
      stubAllEnv();
      const cred = new EnvCredentialLoader().load();
      const descriptor = Object.getOwnPropertyDescriptor(cred, "secretKey");

      expect(descriptor?.enumerable).toBe(false);
    });

    it("secret values are still accessible via direct property access", () => {
      stubAllEnv();
      const cred = new EnvCredentialLoader().load();

      // Non-enumerable does NOT mean inaccessible
      expect(cred.accessLicense).toBe("lic-abc");
      expect(cred.secretKey).toBe("sec-xyz");
    });
  });

  // -------------------------------------------------------------------------
  // ICredentialLoader interface — supports mock implementations
  // -------------------------------------------------------------------------

  describe("ICredentialLoader interface", () => {
    it("allows a stub implementation that returns hardcoded test credentials", () => {
      // This test verifies the interface is usable for dependency injection
      class StubCredentialLoader implements ICredentialLoader {
        load(): NaverAdsCredentials {
          const cred = {} as NaverAdsCredentials;
          Object.defineProperty(cred, "customerId", { value: "stub-id", enumerable: true });
          Object.defineProperty(cred, "accessLicense", { value: "stub-lic", enumerable: false });
          Object.defineProperty(cred, "secretKey", { value: "stub-sec", enumerable: false });
          return cred;
        }
      }

      const loader: ICredentialLoader = new StubCredentialLoader();
      const cred = loader.load();

      expect(cred.customerId).toBe("stub-id");
      expect(cred.accessLicense).toBe("stub-lic");
      expect(cred.secretKey).toBe("stub-sec");
    });

    it("EnvCredentialLoader satisfies ICredentialLoader type", () => {
      stubAllEnv();
      // Type-level check: assign to ICredentialLoader variable
      const loader: ICredentialLoader = new EnvCredentialLoader();
      const cred = loader.load();

      expect(cred.customerId).toBeDefined();
    });
  });
});
