export interface NaverAdsCredentials {
  customerId: string;
  accessLicense: string;
  secretKey: string;
}

export interface ICredentialLoader {
  load(): NaverAdsCredentials;
}

/**
 * Builds a `NaverAdsCredentials` whose `accessLicense`/`secretKey` are
 * non-enumerable, so they are never exposed by `JSON.stringify`,
 * `console.log`, or object spread. Used by env loader and the multi-account
 * bootstrap; tests use it to build fixtures with the same invariant.
 */
export function freezeCredential(
  customerId: string,
  accessLicense: string,
  secretKey: string,
): NaverAdsCredentials {
  const cred = {} as NaverAdsCredentials;
  Object.defineProperty(cred, "customerId", {
    value: customerId,
    enumerable: true,
    writable: false,
    configurable: false,
  });
  Object.defineProperty(cred, "accessLicense", {
    value: accessLicense,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  Object.defineProperty(cred, "secretKey", {
    value: secretKey,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  return cred;
}

export class MissingCredentialError extends Error {
  constructor(keyName: string) {
    super(`Missing required env var: ${keyName}`);
    this.name = "MissingCredentialError";
  }
}

/**
 * Reads Naver Ads credentials from process.env.
 * - Tolerates trailing whitespace in env key names (e.g. "NAVER_ADS_CUSTOMER_ID ").
 * - Tolerates trailing/leading whitespace in values.
 * - Returns an object where `accessLicense` and `secretKey` are non-enumerable
 *   so they do not appear in console.log() or JSON.stringify() output.
 * - Does NOT call dotenv.config(); that is the entry point's responsibility.
 */
export class EnvCredentialLoader implements ICredentialLoader {
  private static readonly KEY_CUSTOMER_ID = "NAVER_ADS_CUSTOMER_ID";
  private static readonly KEY_ACCESS_LICENSE = "NAVER_ADS_ACCESS_LICENSE";
  private static readonly KEY_SECRET_KEY = "NAVER_ADS_SECRET_KEY";

  /**
   * Looks up an env var by canonical key name, tolerating trailing whitespace
   * in the actual key stored in process.env.
   */
  private getEnvValue(canonicalKey: string): string | undefined {
    // Fast path: exact match
    if (process.env[canonicalKey] !== undefined) {
      return process.env[canonicalKey];
    }
    // Slow path: iterate keys and compare trimmed names
    for (const rawKey of Object.keys(process.env)) {
      if (rawKey.trim() === canonicalKey) {
        return process.env[rawKey];
      }
    }
    return undefined;
  }

  load(): NaverAdsCredentials {
    const rawCustomerId = this.getEnvValue(EnvCredentialLoader.KEY_CUSTOMER_ID);
    const rawAccessLicense = this.getEnvValue(
      EnvCredentialLoader.KEY_ACCESS_LICENSE,
    );
    const rawSecretKey = this.getEnvValue(EnvCredentialLoader.KEY_SECRET_KEY);

    if (rawCustomerId === undefined || rawCustomerId.trim() === "") {
      throw new MissingCredentialError(EnvCredentialLoader.KEY_CUSTOMER_ID);
    }
    if (rawAccessLicense === undefined || rawAccessLicense.trim() === "") {
      throw new MissingCredentialError(EnvCredentialLoader.KEY_ACCESS_LICENSE);
    }
    if (rawSecretKey === undefined || rawSecretKey.trim() === "") {
      throw new MissingCredentialError(EnvCredentialLoader.KEY_SECRET_KEY);
    }

    return freezeCredential(
      rawCustomerId.trim(),
      rawAccessLicense.trim(),
      rawSecretKey.trim(),
    );
  }
}
