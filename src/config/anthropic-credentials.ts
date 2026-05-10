// L4 config: ANTHROPIC_API_KEY loader, mirroring credentials.ts patterns.
// The apiKey field is non-enumerable so console.log / JSON.stringify never
// reveal it.

export interface AnthropicCredentials {
  apiKey: string;
}

export interface IAnthropicCredentialLoader {
  load(): AnthropicCredentials;
}

export class MissingAnthropicKeyError extends Error {
  constructor() {
    super(
      "Missing required env var: ANTHROPIC_API_KEY. Add it to .env (the value is never echoed in errors).",
    );
    this.name = "MissingAnthropicKeyError";
  }
}

function freezeAnthropicCred(apiKey: string): AnthropicCredentials {
  const cred = {} as AnthropicCredentials;
  Object.defineProperty(cred, "apiKey", {
    value: apiKey,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  return cred;
}

export class EnvAnthropicCredentialLoader implements IAnthropicCredentialLoader {
  private static readonly KEY = "ANTHROPIC_API_KEY";

  load(): AnthropicCredentials {
    const raw = process.env[EnvAnthropicCredentialLoader.KEY];
    if (raw === undefined || raw.trim() === "") {
      throw new MissingAnthropicKeyError();
    }
    return freezeAnthropicCred(raw.trim());
  }
}
