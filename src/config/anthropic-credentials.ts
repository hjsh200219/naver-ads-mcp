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
  private static readonly PRIMARY_KEY = "ANTHROPIC_API_KEY";
  // CLAUDE_API_KEY is accepted as an alias because some users adopt the
  // Claude-branded name. Primary wins when both are set.
  private static readonly ALIAS_KEY = "CLAUDE_API_KEY";

  load(): AnthropicCredentials {
    const primary = process.env[EnvAnthropicCredentialLoader.PRIMARY_KEY];
    const alias = process.env[EnvAnthropicCredentialLoader.ALIAS_KEY];
    const raw =
      primary !== undefined && primary.trim() !== "" ? primary : alias;
    if (raw === undefined || raw.trim() === "") {
      throw new MissingAnthropicKeyError();
    }
    return freezeAnthropicCred(stripQuotes(raw.trim()));
  }
}

// Some users wrap .env values in quotes ('"sk-..."'). dotenv preserves them
// verbatim. Strip matched surrounding pairs only; don't touch quotes inside
// the actual key body.
function stripQuotes(s: string): string {
  if (s.length < 2) return s;
  const first = s[0];
  const last = s[s.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return s.slice(1, -1);
  }
  return s;
}
